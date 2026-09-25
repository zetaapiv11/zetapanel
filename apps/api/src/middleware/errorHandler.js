import { ZodError } from 'zod';
import { RenderApiError } from '../services/render/renderClient.js';
import { logger } from '../utils/logger.js';

const SECRET_KEY_PATTERNS = [/RENDER_API_KEY/i, /R2_SECRET_ACCESS_KEY/i, /JWT_SECRET/i, /DATABASE_URL/i, /PASSWORD/i];

function scrub(value) {
  if (typeof value !== 'string') return value;
  for (const pattern of SECRET_KEY_PATTERNS) {
    if (pattern.test(value)) return '[redacted]';
  }
  return value;
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: 'Route not found.' } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';

  logger.error(
    { err: { message: err.message, stack: err.stack }, path: req.path, userId: req.user?.id },
    'Request failed'
  );

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { message: 'Validation failed.', details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) },
    });
  }

  if (err instanceof RenderApiError) {
    const status = err.status && err.status < 500 ? err.status : 502;
    return res.status(status).json({
      error: {
        message: 'Render API rejected the request.',
        reason: scrub(err.message),
        ...(isAdmin ? { renderDetails: err.details } : {}),
      },
    });
  }

  if (err.name === 'ForbiddenError') {
    return res.status(403).json({ error: { message: 'You do not have permission to perform this action.' } });
  }

  if (err.message?.includes('R2') || err.message?.includes('S3')) {
    return res.status(502).json({
      error: { message: 'Unable to complete the storage operation.', ...(isAdmin ? { detail: scrub(err.message) } : {}) },
    });
  }

  const status = err.status || 500;
  res.status(status).json({
    error: {
      message: status === 500 ? 'Internal server error.' : scrub(err.message),
      ...(isAdmin && status === 500 ? { detail: scrub(err.message), stack: err.stack } : {}),
    },
  });
}
