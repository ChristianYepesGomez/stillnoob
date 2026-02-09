import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

/**
 * Generate an access token (short-lived)
 * @param {{ id: string, email: string, tier: string }} user
 * @returns {string}
 */
export function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, tier: user.tier },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

/**
 * Generate a refresh token (long-lived)
 * @param {{ id: string }} user
 * @returns {string}
 */
export function generateRefreshToken(user) {
  const secret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
  return jwt.sign(
    { id: user.id, type: 'refresh' },
    secret,
    { expiresIn: '30d' }
  );
}

/**
 * Verify a refresh token
 * @param {string} token
 * @returns {{ id: string } | null}
 */
export function verifyRefreshToken(token) {
  try {
    const secret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
    const decoded = jwt.verify(token, secret);
    if (decoded.type !== 'refresh') return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Express middleware: authenticate JWT from Authorization header
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
}

/**
 * Express middleware: require specific tier
 * @param {string[]} tiers - Allowed tiers
 */
export function requireTier(tiers) {
  return (req, res, next) => {
    if (!req.user || !tiers.includes(req.user.tier)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
