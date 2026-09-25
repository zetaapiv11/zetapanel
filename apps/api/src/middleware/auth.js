import { verifyAccessToken, hashApiKey } from '../utils/crypto.js';
import { prisma } from '../utils/prisma.js';

/**
 * Session auth for the ZetaPanel web app: expects
 * `Authorization: Bearer <JWT access token>`.
 */
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: { message: 'Authentication required.' } });

    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).json({ error: { message: 'User not found.' } });
    if (user.suspended) return res.status(403).json({ error: { message: 'Account suspended.' } });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: { message: 'Invalid or expired token.' } });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: { message: 'Insufficient role for this action.' } });
    }
    next();
  };
}

/**
 * Public REST API auth (`/api/v1/*`): expects
 * `Authorization: Bearer zp_live_...`. Looks up the key by its SHA-256 hash
 * — plaintext keys are never stored, per project rule #14.
 */
export async function requireApiKey(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const key = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!key || !key.startsWith('zp_live_')) {
      return res.status(401).json({ error: { message: 'Missing or malformed API key.' } });
    }

    const keyHash = hashApiKey(key);
    const record = await prisma.apiKey.findUnique({ where: { keyHash }, include: { user: true } });

    if (!record || record.revokedAt) {
      return res.status(401).json({ error: { message: 'Invalid or revoked API key.' } });
    }
    if (record.user.suspended) {
      return res.status(403).json({ error: { message: 'Account suspended.' } });
    }

    prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

    req.user = record.user;
    req.apiKeyPermissions = record.permissions;
    next();
  } catch (err) {
    return res.status(500).json({ error: { message: 'Failed to authenticate API key.' } });
  }
}

/** Granular permission check for API-key-authenticated requests. */
export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.apiKeyPermissions) return next(); // session auth bypasses key-scoped checks
    if (!req.apiKeyPermissions.includes(permission)) {
      return res.status(403).json({ error: { message: `API key is missing permission: ${permission}` } });
    }
    next();
  };
}
