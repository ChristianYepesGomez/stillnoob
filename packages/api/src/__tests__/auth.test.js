import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

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

/** Extract refreshToken value from set-cookie header */
function extractRefreshToken(res) {
  const cookies = res.headers['set-cookie'];
  if (!cookies) return null;
  const arr = Array.isArray(cookies) ? cookies : [cookies];
  for (const c of arr) {
    const match = c.match(/refreshToken=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

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
    token_family TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
});

beforeEach(async () => {
  await client.execute('DELETE FROM refresh_tokens');
  await client.execute('DELETE FROM users');
});

// ── Register ────────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'test@example.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 400 when password is too short', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'short@example.com', password: '1234567' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/8 characters/i);
  });

  it('returns 201 on successful registration', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'new@example.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('new@example.com');
    expect(res.body.user.tier).toBe('free');
    expect(res.body.accessToken).toBeDefined();
  });

  it('sets a refresh token cookie on registration', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'cookie@example.com', password: 'password123' });
    const refreshToken = extractRefreshToken(res);
    expect(refreshToken).toBeTruthy();
  });

  it('returns 409 when email already exists', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'dup@example.com', password: 'password123' });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'dup@example.com', password: 'otherpass123' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already/i);
  });
});

// ── Login ───────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'login@example.com', password: 'correctpass1' });
  });

  it('returns 400 when fields are missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'login@example.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 401 for incorrect password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'login@example.com', password: 'wrongpass11' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it('returns 401 for non-existent user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it('returns 200 with token on successful login', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'login@example.com', password: 'correctpass1' });
    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('login@example.com');
    expect(res.body.accessToken).toBeDefined();
  });
});

// ── Me ──────────────────────────────────────────────────────

describe('GET /api/v1/auth/me', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 200 with user data for valid token', async () => {
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'me@example.com', password: 'password123' });
    const { accessToken } = regRes.body;

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('me@example.com');
    expect(res.body.tier).toBe('free');
  });
});

// ── Refresh token rotation ──────────────────────────────────

describe('POST /api/v1/auth/refresh', () => {
  it('returns 401 without refresh token cookie', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/refresh token/i);
  });

  it('rotates tokens successfully', async () => {
    // Register to get initial tokens
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'refresh@example.com', password: 'password123' });
    const refreshToken = extractRefreshToken(regRes);
    expect(refreshToken).toBeTruthy();

    // Use refresh endpoint
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${refreshToken}`);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();

    // Should set a new (different) refresh token cookie
    const newRefreshToken = extractRefreshToken(res);
    expect(newRefreshToken).toBeTruthy();
    expect(newRefreshToken).not.toBe(refreshToken);
  });

  it('new rotated token is itself valid for another refresh', async () => {
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'chain@example.com', password: 'password123' });
    const token1 = extractRefreshToken(regRes);

    const r1 = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${token1}`);
    expect(r1.status).toBe(200);
    const token2 = extractRefreshToken(r1);

    const r2 = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${token2}`);
    expect(r2.status).toBe(200);
    expect(r2.body.accessToken).toBeDefined();
  });

  it('detects token reuse and revokes the entire family', async () => {
    // Register
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'reuse@example.com', password: 'password123' });
    const originalToken = extractRefreshToken(regRes);

    // First refresh — success, original token is now marked as used
    const firstRefresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${originalToken}`);
    expect(firstRefresh.status).toBe(200);
    const newToken = extractRefreshToken(firstRefresh);

    // Replay the original token — reuse detected
    const reuseAttempt = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${originalToken}`);
    expect(reuseAttempt.status).toBe(401);
    expect(reuseAttempt.body.error).toMatch(/reuse/i);

    // The new token should also be revoked (entire family wiped)
    const afterRevoke = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${newToken}`);
    expect(afterRevoke.status).toBe(401);
  });
});
