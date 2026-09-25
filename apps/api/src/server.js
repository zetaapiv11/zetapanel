import 'dotenv/config';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  logger.error({ missing }, 'Missing required environment variables. See .env.example.');
  process.exit(1);
}

if (!process.env.RENDER_API_KEY) {
  logger.warn('RENDER_API_KEY is not set — server creation/management endpoints will fail until it is configured.');
}
if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET) {
  logger.warn('Cloudflare R2 is not fully configured — file manager endpoints will fail until it is configured.');
}

const app = createApp();
const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
  logger.info(`ZetaPanel API listening on :${port}`);
});
