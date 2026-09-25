/**
 * Centralized Render API client.
 *
 * Source of truth: https://api-docs.render.com (Render Public REST API, base
 * URL https://api.render.com/v1). Every request to Render goes through this
 * module — nothing else in the codebase is allowed to call
 * `fetch('https://api.render.com/...')` directly (see project rule #17).
 *
 * The Render API key NEVER leaves the backend process. It is read once from
 * process.env and attached as a Bearer token on every request.
 */

import { logger } from '../../utils/logger.js';

const RENDER_API_BASE = process.env.RENDER_API_BASE_URL || 'https://api.render.com/v1';
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;

export class RenderApiError extends Error {
  constructor(message, { status, code, details, path } = {}) {
    super(message);
    this.name = 'RenderApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.path = path;
  }
}

function getApiKey() {
  const key = process.env.RENDER_API_KEY;
  if (!key) {
    throw new RenderApiError(
      'RENDER_API_KEY is not configured on the server. Set it in the backend environment before creating or managing servers.',
      { code: 'RENDER_NOT_CONFIGURED' }
    );
  }
  return key;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Low-level request wrapper: auth header, timeout, retry on 429/5xx,
 * and consistent error shape for the rest of the app to consume.
 */
export async function renderRequest(path, { method = 'GET', body, query, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const apiKey = getApiKey();

  const url = new URL(`${RENDER_API_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  let attempt = 0;
  let lastError;

  while (attempt < MAX_RETRIES) {
    attempt += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url.toString(), {
        method,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      clearTimeout(timeout);

      // Render returns 204 for some deletes/actions with no body.
      const text = await res.text();
      const data = text ? safeJsonParse(text) : null;

      if (res.status === 429 && attempt < MAX_RETRIES) {
        const retryAfter = Number(res.headers.get('retry-after')) || attempt * 2;
        logger.warn({ path, attempt }, 'Render API rate limited, backing off');
        await sleep(retryAfter * 1000);
        continue;
      }

      if (res.status >= 500 && attempt < MAX_RETRIES) {
        logger.warn({ path, attempt, status: res.status }, 'Render API 5xx, retrying');
        await sleep(attempt * 500);
        continue;
      }

      if (!res.ok) {
        throw new RenderApiError(
          extractMessage(data) || `Render API request failed with status ${res.status}`,
          { status: res.status, details: data, path }
        );
      }

      return { status: res.status, data };
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;

      if (err instanceof RenderApiError) throw err;

      if (err.name === 'AbortError') {
        if (attempt < MAX_RETRIES) {
          logger.warn({ path, attempt }, 'Render API request timed out, retrying');
          continue;
        }
        throw new RenderApiError('Render API request timed out.', { code: 'TIMEOUT', path });
      }

      // Network-level failure (DNS, connection reset, etc.)
      if (attempt < MAX_RETRIES) {
        await sleep(attempt * 500);
        continue;
      }
    }
  }

  throw new RenderApiError(
    lastError?.message || 'Render API request failed after retries.',
    { code: 'NETWORK_ERROR', path }
  );
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function extractMessage(data) {
  if (!data) return null;
  if (typeof data.message === 'string') return data.message;
  if (Array.isArray(data) && data[0]?.message) return data[0].message;
  return null;
}

export { RENDER_API_BASE };
