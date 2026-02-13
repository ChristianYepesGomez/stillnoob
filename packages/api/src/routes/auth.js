import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db/client.js';
import { users, refreshTokens } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  authenticateToken,
} from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { getAuthorizeUrl, exchangeCode, getUserCharacters } from '../services/blizzard.js';
import { getWclAuthorizeUrl, exchangeWclCode, getWclUserInfo } from '../services/wcl.js';
import { authProviders, characters } from '../db/schema.js';
import { encryptToken } from '../utils/encryption.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Route:Auth');
const OAUTH_STATE_SECRET = process.env.OAUTH_STATE_SECRET;
if (!OAUTH_STATE_SECRET) {
  throw new Error('OAUTH_STATE_SECRET environment variable is required');
}

/**
 * Sign an OAuth state parameter with HMAC-SHA256 to prevent CSRF
 * @param {object} data - State payload
 * @returns {string} base64url-encoded signed state
 */
function signState(data) {
  const payload = JSON.stringify(data);
  const hmac = crypto.createHmac('sha256', OAUTH_STATE_SECRET).update(payload).digest('base64url');
  return Buffer.from(JSON.stringify({ payload, hmac })).toString('base64url');
}

/**
 * Verify and decode a signed OAuth state parameter
 * @param {string} state - base64url-encoded signed state
 * @returns {object|null} decoded payload or null if invalid
 */
function verifyState(state) {
  try {
    const { payload, hmac } = JSON.parse(Buffer.from(state, 'base64url').toString());
    const expected = crypto.createHmac('sha256', OAUTH_STATE_SECRET).update(payload).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) return null;
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

const router = Router();

// POST /api/v1/auth/register
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if email already exists
    const existing = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .get();

    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = crypto.randomUUID();

    await db.insert(users).values({
      id: userId,
      email: email.toLowerCase(),
      passwordHash,
      displayName: displayName || email.split('@')[0],
    });

    const user = { id: userId, email: email.toLowerCase(), tier: 'free' };
    const accessToken = generateAccessToken(user);
    const refreshTkn = generateRefreshToken(user);

    // Store refresh token with new family
    const tokenFamily = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await db.insert(refreshTokens).values({
      userId,
      token: refreshTkn,
      tokenFamily,
      expiresAt,
    });

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshTkn, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/api/v1/auth',
    });

    res.status(201).json({
      user: { id: userId, email: user.email, displayName: displayName || email.split('@')[0], tier: 'free' },
      accessToken,
    });
  } catch (err) {
    log.error('Registration failed', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/v1/auth/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await db.select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .get();

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const tokenPayload = { id: user.id, email: user.email, tier: user.tier };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshTkn = generateRefreshToken(tokenPayload);

    // Store refresh token with new family
    const tokenFamily = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await db.insert(refreshTokens).values({
      userId: user.id,
      token: refreshTkn,
      tokenFamily,
      expiresAt,
    });

    res.cookie('refreshToken', refreshTkn, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        locale: user.locale,
        tier: user.tier,
      },
      accessToken,
    });
  } catch (err) {
    log.error('Login failed', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const decoded = verifyRefreshToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Check token exists in DB
    const stored = await db.select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, token))
      .get();

    if (!stored) {
      return res.status(401).json({ error: 'Refresh token revoked' });
    }

    // Reuse detection: if token was already used, invalidate entire family
    if (stored.used) {
      await db.delete(refreshTokens).where(eq(refreshTokens.tokenFamily, stored.tokenFamily));
      res.clearCookie('refreshToken', { path: '/api/v1/auth' });
      return res.status(401).json({ error: 'Refresh token reuse detected — all sessions in this family revoked' });
    }

    // Mark current token as used (not deleted, kept for reuse detection)
    await db.update(refreshTokens).set({ used: true }).where(eq(refreshTokens.id, stored.id));

    // Get fresh user data
    const user = await db.select()
      .from(users)
      .where(eq(users.id, decoded.id))
      .get();

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const tokenPayload = { id: user.id, email: user.email, tier: user.tier };
    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    // Store new refresh token in the same family
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await db.insert(refreshTokens).values({
      userId: user.id,
      token: newRefreshToken,
      tokenFamily: stored.tokenFamily,
      expiresAt,
    });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    });

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    log.error('Refresh failed', err);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      // Find the token to get its family, then delete the entire family
      const stored = await db.select({ tokenFamily: refreshTokens.tokenFamily })
        .from(refreshTokens)
        .where(eq(refreshTokens.token, token))
        .get();
      if (stored) {
        await db.delete(refreshTokens).where(eq(refreshTokens.tokenFamily, stored.tokenFamily));
      }
    }
    res.clearCookie('refreshToken', { path: '/api/v1/auth' });
    res.json({ message: 'Logged out' });
  } catch (err) {
    log.error('Logout failed', err);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// GET /api/v1/auth/me — get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      locale: users.locale,
      tier: users.tier,
    })
      .from(users)
      .where(eq(users.id, req.user.id))
      .get();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    log.error('Get user failed', err);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// GET /api/v1/auth/blizzard/link — initiate Blizzard OAuth for character linking
router.get('/blizzard/link', authenticateToken, (req, res) => {
  try {
    if (!process.env.BLIZZARD_CLIENT_ID) {
      return res.status(503).json({ error: 'Blizzard OAuth not configured' });
    }

    const state = signState({ userId: req.user.id });
    const authorizeUrl = getAuthorizeUrl(state);
    res.json({ url: authorizeUrl });
  } catch (err) {
    log.error('Blizzard link failed', err);
    res.status(500).json({ error: 'Failed to initiate Blizzard OAuth' });
  }
});

// GET /api/v1/auth/blizzard/callback — Blizzard OAuth callback
router.get('/blizzard/callback', authLimiter, async (req, res) => {
  try {
    const { code, state } = req.query;
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();

    if (!code || !state) {
      return res.redirect(`${frontendUrl}/dashboard?error=blizzard_denied`);
    }

    const stateData = verifyState(state);
    if (!stateData?.userId) {
      return res.redirect(`${frontendUrl}/dashboard?error=invalid_state`);
    }
    const userId = stateData.userId;

    // Exchange code for tokens
    const tokens = await exchangeCode(code);

    // Store Blizzard OAuth provider (tokens encrypted at rest)
    await db.insert(authProviders).values({
      userId,
      provider: 'blizzard',
      providerUserId: userId, // Will be updated with Blizzard user ID
      accessToken: encryptToken(tokens.accessToken),
      refreshToken: encryptToken(tokens.refreshToken),
      tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
    }).onConflictDoNothing();

    // Fetch and import characters
    const blizzChars = await getUserCharacters(tokens.accessToken);
    let imported = 0;

    for (const char of blizzChars) {
      try {
        await db.insert(characters).values({
          userId,
          name: char.name,
          realm: char.realm,
          realmSlug: char.realmSlug,
          region: char.region,
          className: char.className,
          classId: char.classId,
          spec: char.spec,
          raidRole: char.raidRole,
          level: char.level,
          lastSyncedAt: new Date().toISOString(),
        }).onConflictDoNothing();
        imported++;
      } catch {
        // Character already exists — skip
      }
    }

    // Redirect to frontend with success
    res.redirect(`${frontendUrl}/dashboard?blizzard=linked&imported=${imported}`);
  } catch (err) {
    log.error('Blizzard callback failed', err);
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();
    res.redirect(`${frontendUrl}/dashboard?error=blizzard_failed`);
  }
});

// ============================================
// WCL User OAuth (private logs access)
// ============================================

// GET /api/v1/auth/wcl/link — initiate WCL OAuth for private log access
router.get('/wcl/link', authenticateToken, (req, res) => {
  try {
    if (!process.env.WCL_CLIENT_ID) {
      return res.status(503).json({ error: 'WCL OAuth not configured' });
    }

    const state = signState({ userId: req.user.id });
    const authorizeUrl = getWclAuthorizeUrl(state);
    res.json({ url: authorizeUrl });
  } catch (err) {
    log.error('WCL link failed', err);
    res.status(500).json({ error: 'Failed to initiate WCL OAuth' });
  }
});

// GET /api/v1/auth/wcl/callback — WCL OAuth callback
router.get('/wcl/callback', authLimiter, async (req, res) => {
  try {
    const { code, state } = req.query;
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();

    if (!code || !state) {
      return res.redirect(`${frontendUrl}/dashboard?error=wcl_denied`);
    }

    const stateData = verifyState(state);
    if (!stateData?.userId) {
      return res.redirect(`${frontendUrl}/dashboard?error=invalid_state`);
    }
    const userId = stateData.userId;

    // Exchange code for user tokens
    const tokens = await exchangeWclCode(code);

    // Get WCL user info
    const wclUser = await getWclUserInfo(tokens.accessToken);
    const wclUserId = wclUser?.id?.toString() || userId;

    // Store WCL OAuth provider (tokens encrypted at rest)
    await db.insert(authProviders).values({
      userId,
      provider: 'warcraftlogs',
      providerUserId: wclUserId,
      accessToken: encryptToken(tokens.accessToken),
      refreshToken: encryptToken(tokens.refreshToken),
      tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
    }).onConflictDoNothing();

    res.redirect(`${frontendUrl}/dashboard?wcl=linked`);
  } catch (err) {
    log.error('WCL callback failed', err);
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();
    res.redirect(`${frontendUrl}/dashboard?error=wcl_failed`);
  }
});

export default router;
