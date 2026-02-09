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

    // Store refresh token
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await db.insert(refreshTokens).values({
      userId,
      token: refreshTkn,
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
    console.error('Registration error:', err);
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

    // Store refresh token
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await db.insert(refreshTokens).values({
      userId: user.id,
      token: refreshTkn,
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
    console.error('Login error:', err);
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

    // Delete old token (rotation)
    await db.delete(refreshTokens).where(eq(refreshTokens.token, token));

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

    // Store new refresh token
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await db.insert(refreshTokens).values({
      userId: user.id,
      token: newRefreshToken,
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
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      await db.delete(refreshTokens).where(eq(refreshTokens.token, token));
    }
    res.clearCookie('refreshToken', { path: '/api/v1/auth' });
    res.json({ message: 'Logged out' });
  } catch (err) {
    console.error('Logout error:', err);
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
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

export default router;
