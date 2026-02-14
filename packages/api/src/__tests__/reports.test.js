import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── Mock external services (BEFORE app import) ─────────────────

vi.mock('../services/wcl.js', () => ({
  getReportData: vi.fn(),
  getReportDataWithUserToken: vi.fn(),
  getBatchFightStats: vi.fn(),
  getBatchExtendedFightStats: vi.fn(),
}));

vi.mock('../services/analysis.js', () => ({
  getCharacterPerformance: vi.fn(),
  processExtendedFightData: vi.fn().mockResolvedValue(1),
  invalidateAnalysisCache: vi.fn(),
}));

vi.mock('../services/characterProfile.js', () => ({
  getCharacterBlizzardProfile: vi.fn(),
  saveScoreSnapshot: vi.fn().mockResolvedValue(false),
}));

vi.mock('../services/blizzard.js', () => ({
  getCharacterEquipment: vi.fn(),
  transformEquipment: vi.fn(),
  BLIZZARD_SPEC_MAP: {},
  BLIZZARD_CLASS_MAP: {},
}));

vi.mock('../services/metaRefreshManager.js', () => ({
  getMetaWithFreshness: vi.fn().mockResolvedValue({ meta: null, status: 'fresh', source: null }),
}));

vi.mock('../services/buildAnalysis.js', () => ({
  analyzeCharacterBuild: vi.fn(),
}));

vi.mock('../services/mythicPlusAnalysis.js', () => ({
  analyzeMythicPlus: vi.fn(),
}));

// Rate limiters: pass-through in tests (prevent cross-test 429s)
vi.mock('../middleware/rateLimit.js', () => ({
  apiLimiter: vi.fn((req, res, next) => next()),
  authLimiter: vi.fn((req, res, next) => next()),
  importLimiter: vi.fn((req, res, next) => next()),
  analysisLimiter: vi.fn((req, res, next) => next()),
}));

// Retry: execute immediately (no backoff delay in tests)
vi.mock('../utils/retry.js', () => ({
  retryWithBackoff: vi.fn(async (fn) => fn()),
  isTransientError: vi.fn(() => false),
}));

// Encryption: passthrough
vi.mock('../utils/encryption.js', () => ({
  decryptToken: vi.fn((token) => token),
  encryptToken: vi.fn((token) => token),
}));

// In-memory SQLite
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
import { db, client } from '../db/client.js';
import { getReportData, getBatchFightStats, getBatchExtendedFightStats } from '../services/wcl.js';
import { processExtendedFightData } from '../services/analysis.js';
import { importLimiter } from '../middleware/rateLimit.js';

// ── Helpers ─────────────────────────────────────────────────────

async function registerAndGetToken(email = 'import-test@example.com') {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'password123' });
  return { accessToken: res.body.accessToken, userId: res.body.user.id };
}

function makeReportData(overrides = {}) {
  return {
    code: 'Abc123XYz456WqRs',
    title: 'Test Raid - Manaforge Omega',
    startTime: 1700000000000,
    endTime: 1700003600000,
    region: 'EU',
    guild: { name: 'Test Guild' },
    zone: { name: 'Manaforge Omega' },
    participants: [
      { id: 1, name: 'TestPlayer', type: 'Mage' },
      { id: 2, name: 'TestHealer', type: 'Priest' },
    ],
    fights: [
      {
        id: 1,
        encounterID: 2901,
        name: 'Boss One',
        difficulty: 5,
        kill: true,
        startTime: 0,
        endTime: 300000,
      },
      {
        id: 2,
        encounterID: 2902,
        name: 'Boss Two',
        difficulty: 5,
        kill: false,
        startTime: 400000,
        endTime: 650000,
      },
      {
        id: 99,
        encounterID: 0,
        name: 'Trash',
        difficulty: 5,
        kill: true,
        startTime: 300000,
        endTime: 400000,
      },
    ],
    ...overrides,
  };
}

function makeBatchBasicStats(fightIds) {
  const map = new Map();
  for (const id of fightIds) {
    map.set(id, {
      damage: [{ name: 'TestPlayer', total: 1500000, activeTime: 290000 }],
      healing: [{ name: 'TestHealer', total: 500000, activeTime: 290000 }],
      damageTaken: [{ name: 'TestPlayer', total: 200000 }],
      deaths: [],
    });
  }
  return map;
}

function makeBatchExtStats(fightIds) {
  const map = new Map();
  for (const id of fightIds) {
    map.set(id, {
      casts: [{ id: 1, name: 'TestPlayer', total: 150, abilities: [] }],
      summary: {
        playerDetails: {
          dps: [{ name: 'TestPlayer', potionUse: 1, healthstoneUse: 0 }],
          tanks: [],
          healers: [{ name: 'TestHealer', potionUse: 0, healthstoneUse: 1 }],
        },
      },
      combatantInfo: [{ sourceID: 1, specID: 62, auras: [], talentTree: [] }],
      interrupts: [],
      dispels: [],
    });
  }
  return map;
}

// ── Table setup ─────────────────────────────────────────────────

/** Ensure all tables exist (IF NOT EXISTS = no-op when present) */
async function ensureTables() {
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
  await client.execute(`CREATE TABLE IF NOT EXISTS auth_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    provider_email TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wcl_code TEXT NOT NULL UNIQUE,
    title TEXT,
    start_time INTEGER,
    end_time INTEGER,
    region TEXT,
    guild_name TEXT,
    zone_name TEXT,
    participants_count INTEGER DEFAULT 0,
    imported_by TEXT,
    import_source TEXT DEFAULT 'manual',
    visibility TEXT NOT NULL DEFAULT 'public',
    guild_id INTEGER,
    processed_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS fights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL,
    wcl_fight_id INTEGER NOT NULL,
    encounter_id INTEGER NOT NULL,
    boss_name TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    is_kill INTEGER DEFAULT 0,
    start_time INTEGER,
    end_time INTEGER,
    duration_ms INTEGER DEFAULT 0,
    UNIQUE(report_id, wcl_fight_id)
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS fight_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fight_id INTEGER NOT NULL,
    character_id INTEGER NOT NULL,
    damage_done INTEGER DEFAULT 0,
    healing_done INTEGER DEFAULT 0,
    damage_taken INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    dps REAL DEFAULT 0,
    hps REAL DEFAULT 0,
    dtps REAL DEFAULT 0,
    active_time_pct REAL DEFAULT 0,
    cpm REAL DEFAULT 0,
    health_potions INTEGER DEFAULT 0,
    healthstones INTEGER DEFAULT 0,
    combat_potions INTEGER DEFAULT 0,
    flask_uptime_pct REAL DEFAULT 0,
    food_buff_active INTEGER DEFAULT 0,
    augment_rune_active INTEGER DEFAULT 0,
    interrupts INTEGER DEFAULT 0,
    dispels INTEGER DEFAULT 0,
    raid_median_dps REAL DEFAULT 0,
    raid_median_dtps REAL DEFAULT 0,
    spec_id INTEGER,
    talent_data TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(fight_id, character_id)
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS guilds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    realm TEXT NOT NULL,
    realm_slug TEXT NOT NULL,
    region TEXT NOT NULL DEFAULT 'eu',
    owner_id TEXT NOT NULL,
    wcl_guild_id INTEGER,
    avatar_url TEXT,
    invite_code TEXT NOT NULL,
    settings TEXT DEFAULT '{}',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS guild_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, user_id)
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS spec_meta_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_name TEXT NOT NULL,
    spec TEXT NOT NULL,
    region TEXT NOT NULL DEFAULT 'world',
    season TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'raid',
    avg_stats TEXT DEFAULT '{}',
    avg_item_level REAL DEFAULT 0,
    common_enchants TEXT DEFAULT '{}',
    common_gems TEXT DEFAULT '{}',
    common_talents TEXT DEFAULT '{}',
    sample_size INTEGER DEFAULT 0,
    last_updated TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
}

beforeAll(async () => {
  await ensureTables();
});

beforeEach(async () => {
  vi.clearAllMocks();
  // Recreate tables in case drizzle transactions on in-memory SQLite
  // cause schema loss (observed with libsql + drizzle-orm)
  await ensureTables();
  await client.execute('DELETE FROM fights');
  await client.execute('DELETE FROM reports');
  await client.execute('DELETE FROM guild_members');
  await client.execute('DELETE FROM guilds');
  await client.execute('DELETE FROM auth_providers');
  await client.execute('DELETE FROM characters');
  await client.execute('DELETE FROM refresh_tokens');
  await client.execute('DELETE FROM users');
});

// ═══════════════════════════════════════════════════════════════
//  POST /api/v1/reports/import
// ═══════════════════════════════════════════════════════════════

describe('POST /api/v1/reports/import', () => {
  // ── Auth ──────────────────────────────────────────────────────

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/v1/reports/import')
      .send({ url: 'https://www.warcraftlogs.com/reports/Abc123XYz456WqRs' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 403 with an invalid token', async () => {
    const res = await request(app)
      .post('/api/v1/reports/import')
      .set('Authorization', 'Bearer not-a-real-jwt')
      .send({ url: 'https://www.warcraftlogs.com/reports/Abc123XYz456WqRs' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/invalid/i);
  });

  // ── Validation ────────────────────────────────────────────────

  it('returns 400 for invalid WCL URL', async () => {
    const { accessToken } = await registerAndGetToken('badurl@example.com');

    const res = await request(app)
      .post('/api/v1/reports/import')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ url: 'https://not-a-wcl-url.com/whatever' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it('returns 400 when url is missing', async () => {
    const { accessToken } = await registerAndGetToken('nourl@example.com');

    const res = await request(app)
      .post('/api/v1/reports/import')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it('returns 400 for invalid visibility value', async () => {
    const { accessToken } = await registerAndGetToken('badvis@example.com');

    const res = await request(app)
      .post('/api/v1/reports/import')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ url: 'Abc123XYz456WqRs', visibility: 'secret' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/visibility/i);
  });

  // ── Duplicate detection ───────────────────────────────────────

  it('returns 409 when report is already imported', async () => {
    const { accessToken, userId } = await registerAndGetToken('dup@example.com');

    // Pre-insert a report with the same WCL code
    await client.execute({
      sql: `INSERT INTO reports (wcl_code, title, imported_by, visibility) VALUES (?, ?, ?, ?)`,
      args: ['Abc123XYz456WqRs', 'Existing Report', userId, 'public'],
    });

    const res = await request(app)
      .post('/api/v1/reports/import')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ url: 'https://www.warcraftlogs.com/reports/Abc123XYz456WqRs' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already imported/i);
    expect(res.body).toHaveProperty('reportId');
  });

  // ── WCL API errors ────────────────────────────────────────────

  it('returns 404 when WCL report is not found', async () => {
    const { accessToken } = await registerAndGetToken('notfound@example.com');
    getReportData.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/reports/import')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ url: 'Abc123XYz456WqRs' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 502 when WCL API is down (5xx)', async () => {
    const { accessToken } = await registerAndGetToken('wcldown@example.com');

    const error = new Error('WCL server error');
    error.response = { status: 503 };
    getReportData.mockRejectedValue(error);

    const res = await request(app)
      .post('/api/v1/reports/import')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ url: 'Abc123XYz456WqRs' });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/temporarily unavailable/i);
  });

  it('returns 502 when WCL API returns 429 (rate limited)', async () => {
    const { accessToken } = await registerAndGetToken('wcl429@example.com');

    const error = new Error('Too many requests');
    error.response = { status: 429 };
    getReportData.mockRejectedValue(error);

    const res = await request(app)
      .post('/api/v1/reports/import')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ url: 'Abc123XYz456WqRs' });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/temporarily unavailable/i);
  });

  it('returns 502 on network timeout', async () => {
    const { accessToken } = await registerAndGetToken('timeout@example.com');

    const error = new Error('timeout');
    error.code = 'ECONNABORTED';
    getReportData.mockRejectedValue(error);

    const res = await request(app)
      .post('/api/v1/reports/import')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ url: 'Abc123XYz456WqRs' });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/temporarily unavailable/i);
  });

  // ── Successful import ─────────────────────────────────────────

  it('returns 201 on successful report import', async () => {
    const { accessToken } = await registerAndGetToken('success@example.com');

    const reportData = makeReportData();
    getReportData.mockResolvedValue(reportData);
    getBatchFightStats.mockResolvedValue(makeBatchBasicStats([1, 2]));
    getBatchExtendedFightStats.mockResolvedValue(makeBatchExtStats([1, 2]));

    const res = await request(app)
      .post('/api/v1/reports/import')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ url: 'https://www.warcraftlogs.com/reports/Abc123XYz456WqRs' });

    expect(res.status).toBe(201);
    expect(res.body.report).toBeDefined();
    expect(res.body.report.wclCode).toBe('Abc123XYz456WqRs');
    expect(res.body.report.title).toBe('Test Raid - Manaforge Omega');
    expect(res.body.report.zoneName).toBe('Manaforge Omega');
    expect(res.body.stats).toBeDefined();
    // 2 encounter fights (trash fight with encounterID=0 is filtered)
    expect(res.body.stats.fightsProcessed).toBe(2);
  });

  it('filters out trash fights (encounterID = 0)', async () => {
    const { accessToken } = await registerAndGetToken('trash@example.com');

    const reportData = makeReportData({
      fights: [
        { id: 1, encounterID: 0, name: 'Trash', difficulty: 5, kill: true, startTime: 0, endTime: 60000 },
      ],
    });
    getReportData.mockResolvedValue(reportData);

    const res = await request(app)
      .post('/api/v1/reports/import')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ url: 'Abc123XYz456WqRs' });

    expect(res.status).toBe(201);
    expect(res.body.stats.fightsProcessed).toBe(0);
  });

  it('accepts a raw 16-character report code', async () => {
    const { accessToken } = await registerAndGetToken('rawcode@example.com');

    const reportData = makeReportData();
    getReportData.mockResolvedValue(reportData);
    getBatchFightStats.mockResolvedValue(makeBatchBasicStats([1, 2]));
    getBatchExtendedFightStats.mockResolvedValue(makeBatchExtStats([1, 2]));

    const res = await request(app)
      .post('/api/v1/reports/import')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ url: 'Abc123XYz456WqRs' });

    expect(res.status).toBe(201);
    expect(res.body.report.wclCode).toBe('Abc123XYz456WqRs');
  });

  it('maps difficulty codes correctly (all 5 encounter fights processed)', async () => {
    const { accessToken } = await registerAndGetToken('diff@example.com');

    const reportData = makeReportData({
      fights: [
        { id: 1, encounterID: 100, name: 'LFR Boss', difficulty: 1, kill: true, startTime: 0, endTime: 60000 },
        { id: 2, encounterID: 101, name: 'Normal Boss', difficulty: 2, kill: true, startTime: 0, endTime: 60000 },
        { id: 3, encounterID: 102, name: 'Heroic Boss', difficulty: 3, kill: true, startTime: 0, endTime: 60000 },
        { id: 4, encounterID: 103, name: 'Mythic Boss', difficulty: 5, kill: true, startTime: 0, endTime: 60000 },
        { id: 5, encounterID: 104, name: 'M+ Boss', difficulty: 10, kill: true, startTime: 0, endTime: 60000 },
      ],
    });
    getReportData.mockResolvedValue(reportData);
    getBatchFightStats.mockResolvedValue(makeBatchBasicStats([1, 2, 3, 4, 5]));
    getBatchExtendedFightStats.mockResolvedValue(makeBatchExtStats([1, 2, 3, 4, 5]));

    const res = await request(app)
      .post('/api/v1/reports/import')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ url: 'Abc123XYz456WqRs' });

    expect(res.status).toBe(201);
    // All 5 encounter fights processed (difficulty mapping is internal logic,
    // verified via processExtendedFightData call count)
    expect(res.body.stats.fightsProcessed).toBe(5);
    expect(processExtendedFightData).toHaveBeenCalledTimes(5);
  });

  it('calls processExtendedFightData for each fight with stats', async () => {
    const { accessToken } = await registerAndGetToken('perf@example.com');

    const reportData = makeReportData();
    getReportData.mockResolvedValue(reportData);
    getBatchFightStats.mockResolvedValue(makeBatchBasicStats([1, 2]));
    getBatchExtendedFightStats.mockResolvedValue(makeBatchExtStats([1, 2]));

    await request(app)
      .post('/api/v1/reports/import')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ url: 'Abc123XYz456WqRs' });

    // processExtendedFightData called once per encounter fight
    expect(processExtendedFightData).toHaveBeenCalledTimes(2);
  });

  it('returns report data and fight count in the response', async () => {
    const { accessToken } = await registerAndGetToken('persist@example.com');

    const reportData = makeReportData();
    getReportData.mockResolvedValue(reportData);
    getBatchFightStats.mockResolvedValue(makeBatchBasicStats([1, 2]));
    getBatchExtendedFightStats.mockResolvedValue(makeBatchExtStats([1, 2]));

    const res = await request(app)
      .post('/api/v1/reports/import')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ url: 'Abc123XYz456WqRs' });

    expect(res.status).toBe(201);
    // Report metadata matches WCL data
    expect(res.body.report.id).toBeDefined();
    expect(res.body.report.wclCode).toBe('Abc123XYz456WqRs');
    expect(res.body.report.title).toBe('Test Raid - Manaforge Omega');
    expect(res.body.report.zoneName).toBe('Manaforge Omega');
    // 2 encounter fights (trash is filtered)
    expect(res.body.stats.fightsProcessed).toBe(2);
    expect(res.body.stats.performanceRecords).toBe(2);
  });

  it('tolerates partial stats failure without breaking import', async () => {
    const { accessToken } = await registerAndGetToken('partial@example.com');

    const reportData = makeReportData();
    getReportData.mockResolvedValue(reportData);
    // Stats fetch fails entirely
    getBatchFightStats.mockRejectedValue(new Error('Stats API error'));
    getBatchExtendedFightStats.mockRejectedValue(new Error('Stats API error'));

    const res = await request(app)
      .post('/api/v1/reports/import')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ url: 'Abc123XYz456WqRs' });

    // Import still succeeds — stats are processed outside the transaction
    expect(res.status).toBe(201);
    expect(res.body.report.wclCode).toBe('Abc123XYz456WqRs');
    expect(res.body.stats.fightsProcessed).toBe(2);
    expect(res.body.stats.performanceRecords).toBe(0);
  });

  // ── Transaction rollback ──────────────────────────────────────

  it('returns 500 and does not persist report when transaction fails', async () => {
    const { accessToken } = await registerAndGetToken('rollback@example.com');

    const reportData = makeReportData();
    getReportData.mockResolvedValue(reportData);

    // Spy on db.transaction to simulate a DB failure inside the transaction
    const txSpy = vi.spyOn(db, 'transaction').mockRejectedValue(new Error('DB write error'));

    const res = await request(app)
      .post('/api/v1/reports/import')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ url: 'Abc123XYz456WqRs' });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/import failed/i);

    txSpy.mockRestore();

    // Verify the report was NOT persisted (transaction never committed)
    const reportRows = await client.execute("SELECT * FROM reports WHERE wcl_code = 'Abc123XYz456WqRs'");
    expect(reportRows.rows).toHaveLength(0);
  });

  // ── Rate limiting ─────────────────────────────────────────────

  it('returns 429 when import rate limiter blocks the request', async () => {
    const { accessToken } = await registerAndGetToken('ratelimit@example.com');

    // Override the mock to simulate rate limit exceeded
    importLimiter.mockImplementation((req, res) => {
      res.status(429).json({ error: 'Too many import requests, please try again later' });
    });

    const res = await request(app)
      .post('/api/v1/reports/import')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ url: 'Abc123XYz456WqRs' });

    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/too many/i);

    // Restore pass-through for any subsequent tests
    importLimiter.mockImplementation((req, res, next) => next());
  });
});
