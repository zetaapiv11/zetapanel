/**
 * Wrapper around Render's Deploys endpoints.
 * Reference: https://api-docs.render.com (tag: Deploys)
 *
 * Real, documented endpoints used here:
 *   GET  /v1/services/{serviceId}/deploys
 *   GET  /v1/services/{serviceId}/deploys/{deployId}
 *   POST /v1/services/{serviceId}/deploys
 *   POST /v1/services/{serviceId}/deploys/{deployId}/cancel
 *   POST /v1/services/{serviceId}/rollback
 */

import { renderRequest } from './renderClient.js';

export async function listDeploys(renderServiceId, { limit = 20, cursor } = {}) {
  const { data } = await renderRequest(`/services/${renderServiceId}/deploys`, {
    query: { limit, cursor },
  });
  return data;
}

export async function getDeploy(renderServiceId, deployId) {
  const { data } = await renderRequest(`/services/${renderServiceId}/deploys/${deployId}`);
  return data;
}

/**
 * Trigger a deploy. `clearCache` maps to Render's documented
 * `clearCache: "clear" | "do_not_clear"` option on this endpoint.
 */
export async function triggerDeploy(renderServiceId, { clearCache = false, commitId } = {}) {
  const body = {
    clearCache: clearCache ? 'clear' : 'do_not_clear',
  };
  if (commitId) body.commitId = commitId;

  const { data } = await renderRequest(`/services/${renderServiceId}/deploys`, {
    method: 'POST',
    body,
  });
  return data;
}

export async function cancelDeploy(renderServiceId, deployId) {
  const { data } = await renderRequest(
    `/services/${renderServiceId}/deploys/${deployId}/cancel`,
    { method: 'POST' }
  );
  return data;
}

export async function rollbackDeploy(renderServiceId, deployId) {
  const { data } = await renderRequest(`/services/${renderServiceId}/rollback`, {
    method: 'POST',
    body: { deployId },
  });
  return data;
}
