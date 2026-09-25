import { prisma } from '../utils/prisma.js';
import { hashPassword, verifyPassword, signAccessToken, generateRefreshToken } from '../utils/crypto.js';
import { registerSchema, loginSchema } from '../validators/schemas.js';
import { logActivity } from '../utils/activity.js';

const REFRESH_COOKIE = 'zp_refresh';
const isProd = process.env.NODE_ENV === 'production';

function setRefreshCookie(res, token, expiresAt) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    expires: expiresAt,
    path: '/api/auth',
  });
}

export async function register(req, res, next) {
  try {
    const { email, password } = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: { message: 'An account with this email already exists.' } });

    const passwordHash = await hashPassword(password);
    const isFirstUser = (await prisma.user.count()) === 0;

    const user = await prisma.user.create({
      data: { email, passwordHash, role: isFirstUser ? 'SUPER_ADMIN' : 'USER' },
    });

    await logActivity({ userId: user.id, action: 'user.registered', ip: req.ip });
    return issueTokens(res, user, 201);
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: { message: 'Invalid email or password.' } });
    if (user.suspended) return res.status(403).json({ error: { message: 'Account suspended.' } });

    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) return res.status(401).json({ error: { message: 'Invalid email or password.' } });

    await logActivity({ userId: user.id, action: 'user.login', ip: req.ip });
    return issueTokens(res, user, 200);
  } catch (err) {
    next(err);
  }
}

async function issueTokens(res, user, status) {
  const accessToken = signAccessToken(user);
  const { token: refreshToken, expiresAt } = generateRefreshToken();

  await prisma.session.create({
    data: { userId: user.id, refreshToken, expiresAt },
  });

  setRefreshCookie(res, refreshToken, expiresAt);
  res.status(status).json({
    accessToken,
    user: { id: user.id, email: user.email, role: user.role },
  });
}

export async function refresh(req, res, next) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) return res.status(401).json({ error: { message: 'No refresh token provided.' } });

    const session = await prisma.session.findUnique({ where: { refreshToken: token }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return res.status(401).json({ error: { message: 'Refresh token invalid or expired.' } });
    }

    // Rotate: revoke old, issue new (refresh token rotation, rule #20).
    await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    const { token: newRefreshToken, expiresAt } = generateRefreshToken();
    await prisma.session.create({ data: { userId: session.userId, refreshToken: newRefreshToken, expiresAt } });
    setRefreshCookie(res, newRefreshToken, expiresAt);

    const accessToken = signAccessToken(session.user);
    res.json({ accessToken, user: { id: session.user.id, email: session.user.email, role: session.user.role } });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      await prisma.session.updateMany({ where: { refreshToken: token }, data: { revokedAt: new Date() } });
    }
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res) {
  res.json({ user: { id: req.user.id, email: req.user.email, role: req.user.role } });
}
