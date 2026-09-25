/**
 * Wrapper around Render's Logs endpoint.
 * Reference: https://api-docs.render.com (tag: Logs)
 *
 * Real, documented endpoint used here:
 *   GET /v1/logs?resource={serviceId}&limit=...&startTime=...&endTime=...&direction=...
 *
 * Render also documents a log-streaming (SSE) endpoint
 * (`GET /v1/logs/subscribe`). ZetaPanel's console currently uses polling
 * against `/v1/logs` because it works uniformly across every deploy target
 * without requiring a separate SSE client/reconnection stack. If you want
 * true push-based streaming, implement `subscribeToLogs` below against
 * `/v1/logs/subscribe` per the current OpenAPI spec — do not fake it with
 * setInterval dressed up as a socket.
 */

import { renderRequest } from './renderClient.js';

/**
 * Fetch a page of logs for a service. Returns Render's raw log entries;
 * the controller layer normalizes timestamps for the frontend terminal.
 */
export async function getServiceLogs(renderServiceId, { limit = 100, startTime, endTime, direction = 'backward' } = {}) {
  const { data } = await renderRequest('/logs', {
    query: {
      resource: renderServiceId,
      limit,
      startTime,
      endTime,
      direction,
    },
  });
  return data;
}

/**
 * NOT IMPLEMENTED: real-time push streaming via Render's SSE logs endpoint.
 * Left as an explicit extension point per project rule ("jangan pura-pura
 * mendukungnya"). Calling this throws until implemented against a verified
 * Render SSE contract.
 */
export async function subscribeToLogs() {
  throw new Error(
    'Real-time log streaming (SSE) is not implemented. The console falls back to polling getServiceLogs() every few seconds.'
  );
}
