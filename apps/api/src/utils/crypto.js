import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import crypto from 'node:crypto';

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);

export async function hashPassword(plain) {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(hash, plain) {
  return argon2.verify(hash, plain);
}

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

export function generateRefreshToken() {
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  return { token, expiresAt };
}

/** ZetaPanel API keys: zp_live_<32 random hex chars>; only the hash is stored. */
export function generateApiKey() {
  const raw = crypto.randomBytes(24).toString('hex');
  const key = `zp_live_${raw}`;
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');
  const keyPrefix = key.slice(0, 12);
  return { key, keyHash, keyPrefix };
}

export function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}
