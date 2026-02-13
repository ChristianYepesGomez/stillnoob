import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// Mock external services that the public route depends on
vi.mock('../services/analysis.js', () => ({
  getCharacterPerformance: vi.fn(),
  processExtendedFightData: vi.fn(),
  invalidateAnalysisCache: vi.fn(),
}));

vi.mock('../services/raiderio.js', () => ({
  getCharacterRaiderIO: vi.fn(),
}));

vi.mock('../services/blizzard.js', () => ({
  getCharacterEquipment: vi.fn().mockResolvedValue(null),
  transformEquipment: vi.fn(),
  getRealmList: vi.fn(),
  getCharacterProfile: vi.fn().mockResolvedValue(null),
  getCharacterMedia: vi.fn().mockResolvedValue(null),
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
import { getCharacterPerformance } from '../services/analysis.js';
import { getCharacterRaiderIO } from '../services/raiderio.js';
import { getCharacterProfile, getCharacterMedia, getRealmList } from '../services/blizzard.js';

const mockPerformanceData = {
  score: { total: 75, tier: { name: 'Good', min: 60, max: 79 }, breakdown: {} },
  summary: {
    totalFights: 10, avgDps: 5000, avgHps: 0, deathRate: 0.1,
    consumableScore: 80, dpsVsMedianPct: 105,
    avgActiveTime: 87.5, avgCpm: 35.2, avgParsePercentile: 62,
  },
  bossBreakdown: [{
    bossName: 'Test Boss', difficulty: 'Heroic', fights: 5,
    avgDps: 5000, bestDps: 6000, deathRate: 0.1, dpsVsMedian: 105,
    parsePercentile: 62, avgActiveTime: 87.5, avgCpm: 35.2,
  }],
  weeklyTrends: [],
  recentFights: [],
  recommendations: { primaryTips: [], secondaryTips: [], playerLevel: 'beginner' },
};

const mockRaiderIO = { score: 1500, bestRun: null };

beforeAll(async () => {
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

  // Seed a test character
  await client.execute({
    sql: `INSERT INTO characters (user_id, name, realm, realm_slug, region, class_name, spec, raid_role)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: ['test-user-id', 'Testchar', 'Silvermoon', 'silvermoon', 'eu', 'Mage', 'Fire', 'DPS'],
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  getCharacterPerformance.mockResolvedValue(mockPerformanceData);
  getCharacterRaiderIO.mockResolvedValue(mockRaiderIO);
  getCharacterProfile.mockResolvedValue(null);
  getCharacterMedia.mockResolvedValue(null);
});

describe('GET /api/v1/public/character/:region/:realm/:name', () => {
  it('returns character data with source: database for existing character', async () => {
    const res = await request(app).get('/api/v1/public/character/eu/silvermoon/Testchar');
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('database');
    expect(res.body.character).toBeDefined();
    expect(res.body.character.name).toBe('Testchar');
    expect(res.body.character.className).toBe('Mage');
    expect(res.body.character.spec).toBe('Fire');
    expect(res.body.score).toBeDefined();
    expect(res.body.summary).toBeDefined();
    expect(res.body.bossBreakdown).toBeInstanceOf(Array);
    expect(res.body.raiderIO).toBeDefined();
  });

  it('matches character name case-insensitively', async () => {
    const res = await request(app).get('/api/v1/public/character/eu/silvermoon/testchar');
    expect(res.status).toBe(200);
    expect(res.body.character.name).toBe('Testchar');
  });

  it('falls back to live Blizzard API when character not in DB', async () => {
    getCharacterProfile.mockResolvedValue({
      name: 'Newchar', realm: 'Stormrage', realmSlug: 'stormrage',
      className: 'Warrior', spec: 'Arms', raidRole: 'DPS',
      level: 80, averageItemLevel: 620, equippedItemLevel: 618,
    });
    getCharacterMedia.mockResolvedValue({ avatar: 'http://img/avatar.jpg', inset: null, main: null, mainRaw: null });
    getCharacterRaiderIO.mockResolvedValue(mockRaiderIO);

    const res = await request(app).get('/api/v1/public/character/eu/stormrage/Newchar');
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('live');
    expect(res.body.character.name).toBe('Newchar');
    expect(res.body.character.className).toBe('Warrior');
    expect(res.body.character.equippedItemLevel).toBe(618);
    expect(res.body.character.media).toBeDefined();
    expect(res.body.score).toBeNull();
    expect(res.body.summary).toBeNull();
    expect(res.body.bossBreakdown).toEqual([]);
    expect(res.body.raiderIO).toBeDefined();
  });

  it('returns 404 when character not in DB and not on Blizzard', async () => {
    getCharacterProfile.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/public/character/eu/silvermoon/Nobody');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 404 for wrong realm when not on Blizzard either', async () => {
    getCharacterProfile.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/public/character/eu/stormrage/Testchar');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});

describe('GET /api/v1/public/realms/:region', () => {
  it('returns realm list for valid region', async () => {
    getRealmList.mockResolvedValue([
      { id: 1, name: 'Silvermoon', slug: 'silvermoon' },
      { id: 2, name: 'Stormrage', slug: 'stormrage' },
    ]);
    const res = await request(app).get('/api/v1/public/realms/eu');
    expect(res.status).toBe(200);
    expect(res.body.realms).toHaveLength(2);
    expect(res.body.realms[0].name).toBe('Silvermoon');
  });

  it('returns 400 for invalid region', async () => {
    const res = await request(app).get('/api/v1/public/realms/xx');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid region/i);
  });
});
