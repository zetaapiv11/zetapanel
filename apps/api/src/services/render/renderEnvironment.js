/**
 * Wrapper around Render's per-service Environment Variables endpoints.
 * Reference: https://api-docs.render.com (tag: Environment Variables)
 *
 * Real, documented endpoints used here:
 *   GET  /v1/services/{serviceId}/env-vars
 *   PUT  /v1/services/{serviceId}/env-vars           (bulk replace)
 *   PUT  /v1/services/{serviceId}/env-vars/{envVarKey}
 *   DELETE /v1/services/{serviceId}/env-vars/{envVarKey}
 *
 * Updating env vars on Render triggers an automatic deploy unless the
 * service has autoDeploy disabled — ZetaPanel does not additionally fake
 * a "restart" on top of this; it just reflects Render's own behavior back
 * to the user in the activity log.
 */

import { renderRequest } from './renderClient.js';

export async function listEnvVars(renderServiceId) {
  const { data } = await renderRequest(`/services/${renderServiceId}/env-vars`);
  return data;
}

export async function replaceAllEnvVars(renderServiceId, envVars) {
  // envVars: [{ key, value }]
  const { data } = await renderRequest(`/services/${renderServiceId}/env-vars`, {
    method: 'PUT',
    body: envVars,
  });
  return data;
}

export async function upsertEnvVar(renderServiceId, key, value) {
  const { data } = await renderRequest(`/services/${renderServiceId}/env-vars/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: { value },
  });
  return data;
}

export async function deleteEnvVar(renderServiceId, key) {
  await renderRequest(`/services/${renderServiceId}/env-vars/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  });
  return true;
}
