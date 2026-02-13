import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// Mock external services that the analysis routes depend on
vi.mock('../services/analysis.js', () => ({
  getCharacterPerformance: vi.fn(),
  processExtendedFightData: vi.fn(),
  invalidateAnalysisCache: vi.fn(),
}));

vi.mock('../services/raiderio.js', () => ({
  getCharacterRaiderIO: vi.fn(),
  saveScoreSnapshot: vi.fn(),
}));

vi.mock('../services/blizzard.js', () => ({
  getCharacterEquipment: vi.fn(),
  transformEquipment: vi.fn(),
}));

vi.mock('../services/buildAnalysis.js', () => ({
  analyzeCharacterBuild: vi.fn(),
}));

vi.mock('../services/mythicPlusAnalysis.js', () => ({
  analyzeMythicPlus: vi.fn(),
}));

// Mock db with in-memory SQLite
vi.mock('../db/client.js', async () => {
  const { createClient } = await import('@libsql/client');
  const { drizzle } = await import('drizzle-orm/libsql');
  const schema = await import('../db/schema.js');
  const client = createClient({ url: ':memory:' });
  const db = drizzle(client, { schema });
  return { db, client };
});

import request from 'supertest';
import app from '../app.js';
import { client } from '../db/client.js';
import { getCharacterEquipment, transformEquipment } from '../services/blizzard.js';
import { analyzeCharacterBuild } from '../services/buildAnalysis.js';

// Helper: register a user and return the access token + user id
async function registerAndGetToken(email = 'build-test@example.com') {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'password123' });
  return { accessToken: res.body.accessToken, userId: res.body.user.id };
}

beforeAll(async () => {
  // Create minimal tables needed for auth + character ownership
  await client.execute(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    email_verified INTEGER DEFAULT 0,
    password_hash TEXT,
    display_name TEXT,
    avatar_url TEXT,
    locale TEXT DEFAULT 'en',
    tier TEXT DEFAULT 'free',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    token_family TEXT NOT NULL DEFAULT 'legacy',
    used INTEGER DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    realm TEXT NOT NULL,
    realm_slug TEXT NOT NULL,
    region TEXT NOT NULL DEFAULT 'eu',
    class_name TEXT NOT NULL,
    class_id INTEGER,
    spec TEXT,
    raid_role TEXT,
    level INTEGER DEFAULT 0,
    is_primary INTEGER DEFAULT 0,
    last_synced_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS spec_meta_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_name TEXT NOT NULL,
    spec TEXT NOT NULL,
    region TEXT NOT NULL DEFAULT 'world',
    season TEXT NOT NULL,
    avg_stats TEXT DEFAULT '{}',
    avg_item_level REAL DEFAULT 0,
    common_enchants TEXT DEFAULT '{}',
    common_gems TEXT DEFAULT '{}',
    sample_size INTEGER DEFAULT 0,
    last_updated TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
});

beforeEach(async () => {
  vi.clearAllMocks();
  await client.execute('DELETE FROM characters');
  await client.execute('DELETE FROM refresh_tokens');
  await client.execute('DELETE FROM users');
  await client.execute('DELETE FROM spec_meta_cache');
});

// ═══════════════════════════════════════════════════════════════
//  GET /api/v1/analysis/character/:id/build
// ═══════════════════════════════════════════════════════════════

describe('GET /api/v1/analysis/character/:id/build', () => {
  // ── Auth checks ──

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/analysis/character/1/build');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 403 with an invalid token', async () => {
    const res = await request(app)
      .get('/api/v1/analysis/character/1/build')
      .set('Authorization', 'Bearer not-a-real-jwt');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/invalid/i);
  });

  // ── Param validation ──

  it('returns 400 for non-numeric character ID', async () => {
    const { accessToken } = await registerAndGetToken();

    const res = await request(app)
      .get('/api/v1/analysis/character/abc/build')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid character id/i);
  });

  it('returns 400 for "NaN" character ID', async () => {
    const { accessToken } = await registerAndGetToken();

    const res = await request(app)
      .get('/api/v1/analysis/character/NaN/build')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid character id/i);
  });

  // ── Ownership / not found ──

  it('returns 404 for a character that does not exist', async () => {
    const { accessToken } = await registerAndGetToken();

    const res = await request(app)
      .get('/api/v1/analysis/character/99999/build')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 404 when character belongs to a different user', async () => {
    // Register owner and create a character
    const { userId: ownerId } = await registerAndGetToken('owner@example.com');
    await client.execute({
      sql: `INSERT INTO characters (user_id, name, realm, realm_slug, region, class_name, spec, raid_role)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [ownerId, 'OwnerChar', 'Silvermoon', 'silvermoon', 'eu', 'Mage', 'Fire', 'DPS'],
    });
    const charRow = await client.execute('SELECT id FROM characters WHERE name = ?', ['OwnerChar']);
    const charId = charRow.rows[0].id;

    // Register a different user and try to access the character
    const { accessToken: otherToken } = await registerAndGetToken('other@example.com');

    const res = await request(app)
      .get(`/api/v1/analysis/character/${charId}/build`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  // ── Equipment not available ──

  it('returns 404 when Blizzard equipment data is not available', async () => {
    const { accessToken, userId } = await registerAndGetToken();

    // Seed a character owned by this user
    await client.execute({
      sql: `INSERT INTO characters (user_id, name, realm, realm_slug, region, class_name, spec, raid_role)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [userId, 'TestMage', 'Silvermoon', 'silvermoon', 'eu', 'Mage', 'Fire', 'DPS'],
    });
    const charRow = await client.execute('SELECT id FROM characters WHERE name = ?', ['TestMage']);
    const charId = charRow.rows[0].id;

    // Blizzard API returns null (no equipment)
    getCharacterEquipment.mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/v1/analysis/character/${charId}/build`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/equipment/i);
  });

  // ── Happy path ──

  it('returns 200 with build analysis for a valid character', async () => {
    const { accessToken, userId } = await registerAndGetToken();

    await client.execute({
      sql: `INSERT INTO characters (user_id, name, realm, realm_slug, region, class_name, spec, raid_role)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [userId, 'HappyMage', 'Silvermoon', 'silvermoon', 'eu', 'Mage', 'Fire', 'DPS'],
    });
    const charRow = await client.execute('SELECT id FROM characters WHERE name = ?', ['HappyMage']);
    const charId = charRow.rows[0].id;

    const mockEquipment = { equipped_items: [{ slot: { type: 'HEAD' }, level: { value: 620 } }] };
    const mockTransformed = { items: [{ slot: 'HEAD', itemLevel: 620 }], avgItemLevel: 620 };
    const mockBuildResult = {
      itemLevel: 620,
      statAlignment: 'good',
      tips: [{ category: 'gear', key: 'enchant_missing', severity: 'warning', priority: 10, data: {} }],
    };

    getCharacterEquipment.mockResolvedValue(mockEquipment);
    transformEquipment.mockReturnValue(mockTransformed);
    analyzeCharacterBuild.mockReturnValue(mockBuildResult);

    const res = await request(app)
      .get(`/api/v1/analysis/character/${charId}/build`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.itemLevel).toBe(620);
    expect(res.body.statAlignment).toBe('good');
    expect(res.body.tips).toBeInstanceOf(Array);
    expect(res.body.tips).toHaveLength(1);

    // Verify the external services were called with the right args
    expect(getCharacterEquipment).toHaveBeenCalledWith('HappyMage', 'silvermoon', 'eu');
    expect(transformEquipment).toHaveBeenCalledWith(mockEquipment);
    expect(analyzeCharacterBuild).toHaveBeenCalledWith(mockTransformed, 'Mage', 'Fire', null);
  });

  it('passes specMeta from cache to analyzeCharacterBuild when available', async () => {
    const { accessToken, userId } = await registerAndGetToken();

    await client.execute({
      sql: `INSERT INTO characters (user_id, name, realm, realm_slug, region, class_name, spec, raid_role)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [userId, 'MetaMage', 'Silvermoon', 'silvermoon', 'eu', 'Mage', 'Fire', 'DPS'],
    });
    const charRow = await client.execute('SELECT id FROM characters WHERE name = ?', ['MetaMage']);
    const charId = charRow.rows[0].id;

    // Insert fresh spec meta cache (within 7 days)
    const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    await client.execute({
      sql: `INSERT INTO spec_meta_cache (class_name, spec, region, season, avg_stats, avg_item_level, common_enchants, common_gems, sample_size, last_updated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: ['Mage', 'Fire', 'world', 'midnight-1', '{"crit":30,"haste":25}', 625, '{"weapon":"enchant_a"}', '{"meta":"gem_a"}', 500, recentDate],
    });

    const mockEquipment = { equipped_items: [] };
    const mockTransformed = { items: [], avgItemLevel: 610 };
    const mockBuildResult = { itemLevel: 610, statAlignment: 'mixed', tips: [] };

    getCharacterEquipment.mockResolvedValue(mockEquipment);
    transformEquipment.mockReturnValue(mockTransformed);
    analyzeCharacterBuild.mockReturnValue(mockBuildResult);

    const res = await request(app)
      .get(`/api/v1/analysis/character/${charId}/build`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);

    // Verify specMeta was passed (4th argument should not be null)
    expect(analyzeCharacterBuild).toHaveBeenCalledWith(
      mockTransformed,
      'Mage',
      'Fire',
      expect.objectContaining({
        avgStats: { crit: 30, haste: 25 },
        avgItemLevel: 625,
        commonEnchants: { weapon: 'enchant_a' },
        commonGems: { meta: 'gem_a' },
        sampleSize: 500,
      }),
    );
  });

  it('returns 500 when Blizzard API throws an unexpected error', async () => {
    const { accessToken, userId } = await registerAndGetToken();

    await client.execute({
      sql: `INSERT INTO characters (user_id, name, realm, realm_slug, region, class_name, spec, raid_role)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [userId, 'ErrorMage', 'Silvermoon', 'silvermoon', 'eu', 'Mage', 'Fire', 'DPS'],
    });
    const charRow = await client.execute('SELECT id FROM characters WHERE name = ?', ['ErrorMage']);
    const charId = charRow.rows[0].id;

    getCharacterEquipment.mockRejectedValue(new Error('Blizzard API timeout'));

    const res = await request(app)
      .get(`/api/v1/analysis/character/${charId}/build`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed/i);
  });
});
