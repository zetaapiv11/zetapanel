/**
 * Wrapper around Render's Services endpoints.
 * Reference: https://api-docs.render.com  (tag: Services)
 *
 * Real, documented endpoints used here:
 *   GET    /v1/services
 *   GET    /v1/services/{serviceId}
 *   POST   /v1/services
 *   PATCH  /v1/services/{serviceId}
 *   DELETE /v1/services/{serviceId}
 *   POST   /v1/services/{serviceId}/suspend     (web/private services only)
 *   POST   /v1/services/{serviceId}/resume
 *   POST   /v1/services/{serviceId}/restart
 *
 * NOTE ON UNSUPPORTED OPERATIONS:
 * Render does not expose a generic "stop" for every service type — suspend/
 * resume is only documented for services backed by a running instance
 * (web services, private services, background workers). Cron Jobs and
 * one-off Jobs don't support suspend/resume; ZetaPanel surfaces this as
 * `supportsSuspend: false` on those service types instead of pretending the
 * action exists (see mapServiceType below).
 */

import { renderRequest, RenderApiError } from './renderClient.js';

// Render "type" values as documented for POST /v1/services.
export const RENDER_SERVICE_TYPES = [
  'web_service',
  'private_service',
  'background_worker',
  'cron_job',
  'static_site',
];

const SUSPEND_CAPABLE_TYPES = new Set(['web_service', 'private_service', 'background_worker']);

export function supportsSuspend(serviceType) {
  return SUSPEND_CAPABLE_TYPES.has(serviceType);
}

/**
 * Build the Render `POST /v1/services` payload from ZetaPanel's form data.
 * Only fields Render actually documents are included — nothing invented.
 */
export function buildCreateServicePayload(input) {
  const {
    name,
    serviceType, // one of RENDER_SERVICE_TYPES
    repo, // git repository URL
    branch,
    buildCommand,
    startCommand,
    preDeployCommand,
    region,
    plan,
    autoDeploy,
    healthCheckPath,
    envVars = [], // [{ key, value }]
    runtime, // 'node' | 'python' | 'ruby' | 'go' | 'elixir' | 'docker' | 'rust'
  } = input;

  if (!RENDER_SERVICE_TYPES.includes(serviceType)) {
    throw new RenderApiError(`Unsupported Render service type: ${serviceType}`, {
      code: 'UNSUPPORTED_SERVICE_TYPE',
    });
  }

  const payload = {
    type: serviceType,
    name,
    repo,
    branch: branch || 'main',
    autoDeploy: autoDeploy ? 'yes' : 'no',
  };

  // serviceDetails shape differs slightly per type per Render's schema,
  // but for buildable (non static-site) services the common envSpecificDetails
  // + build/start command structure applies.
  const serviceDetails = {
    region,
    plan,
    envSpecificDetails: buildEnvSpecificDetails(runtime, buildCommand, startCommand),
  };

  if (preDeployCommand) serviceDetails.preDeployCommand = preDeployCommand;
  if (healthCheckPath && (serviceType === 'web_service' || serviceType === 'private_service')) {
    serviceDetails.healthCheckPath = healthCheckPath;
  }

  payload.serviceDetails = serviceDetails;

  if (envVars.length) {
    payload.envVars = envVars.map((e) => ({ key: e.key, value: e.value }));
  }

  return payload;
}

/**
 * The real "upload a ZIP and just run it" path (project rule #34).
 *
 * Render cannot run code straight out of R2, so this builds a payload for a
 * Docker-runtime service that points at ZetaPanel's own `apps/runtime`
 * Dockerfile (same repo ZetaPanel itself is deployed from). At container
 * start, that image downloads the user's extracted project from R2 and
 * execs their start command — see apps/runtime/sync-and-run.js.
 *
 * SECURITY NOTE: this passes the R2 secret key into a container that runs
 * arbitrary user-uploaded code. It is scoped to the right *prefix* by the
 * app, but the credential itself is bucket-wide unless you create the R2
 * API token with a bucket/prefix-scoped policy (Cloudflare supports this —
 * do it before using this in production with untrusted users).
 */
export function buildR2BridgeServicePayload({
  name,
  serviceType,
  region,
  plan,
  autoDeploy,
  branch,
  runtimeRepo, // Git URL of the repo containing apps/runtime (usually ZetaPanel's own repo)
  buildCommand,
  startCommand,
  r2: { accountId, accessKeyId, secretAccessKey, bucket, prefix },
  envVars = [],
}) {
  if (!RENDER_SERVICE_TYPES.includes(serviceType)) {
    throw new RenderApiError(`Unsupported Render service type: ${serviceType}`, { code: 'UNSUPPORTED_SERVICE_TYPE' });
  }
  if (!runtimeRepo) {
    throw new RenderApiError(
      'ZETAPANEL_RUNTIME_REPO is not configured — the R2 "upload and run" bridge needs a Git URL that contains apps/runtime/Dockerfile.',
      { code: 'RUNTIME_REPO_NOT_CONFIGURED' }
    );
  }

  return {
    type: serviceType,
    name,
    repo: runtimeRepo,
    branch: branch || 'main',
    autoDeploy: autoDeploy ? 'yes' : 'no',
    serviceDetails: {
      region,
      plan,
      envSpecificDetails: {
        dockerfilePath: 'apps/runtime/Dockerfile',
        dockerContext: 'apps/runtime',
      },
    },
    envVars: [
      { key: 'R2_ACCOUNT_ID', value: accountId },
      { key: 'R2_ACCESS_KEY_ID', value: accessKeyId },
      { key: 'R2_SECRET_ACCESS_KEY', value: secretAccessKey },
      { key: 'R2_BUCKET', value: bucket },
      { key: 'R2_PREFIX', value: prefix },
      { key: 'APP_BUILD_COMMAND', value: buildCommand || '' },
      { key: 'APP_START_COMMAND', value: startCommand },
      ...envVars.map((e) => ({ key: e.key, value: e.value })),
    ],
  };
}

function buildEnvSpecificDetails(runtime, buildCommand, startCommand) {
  // Render's "runtime" field on serviceDetails.envSpecificDetails is
  // language-specific (node/python/ruby/go/elixir/rust) or "docker" for
  // image-based deploys. We pass through build/start commands for
  // buildpack-based runtimes; for docker, dockerfilePath/dockerContext
  // would be required instead (left as an extension point — ZetaPanel's
  // Create Server form currently targets buildpack runtimes, and marks
  // "Docker" as requiring a Dockerfile path not yet collected by the UI).
  if (runtime === 'docker') {
    return { dockerfilePath: './Dockerfile' };
  }
  return {
    buildCommand: buildCommand || undefined,
    startCommand: startCommand || undefined,
  };
}

export async function createService(payload) {
  const { data } = await renderRequest('/services', { method: 'POST', body: payload });
  return data;
}

export async function listServices({ limit = 20, cursor } = {}) {
  const { data } = await renderRequest('/services', { query: { limit, cursor } });
  return data;
}

export async function getService(renderServiceId) {
  const { data } = await renderRequest(`/services/${renderServiceId}`);
  return data;
}

export async function updateService(renderServiceId, patch) {
  const { data } = await renderRequest(`/services/${renderServiceId}`, {
    method: 'PATCH',
    body: patch,
  });
  return data;
}

export async function deleteService(renderServiceId) {
  await renderRequest(`/services/${renderServiceId}`, { method: 'DELETE' });
  return true;
}

export async function restartService(renderServiceId) {
  const { data } = await renderRequest(`/services/${renderServiceId}/restart`, { method: 'POST' });
  return data;
}

export async function suspendService(renderServiceId, serviceType) {
  if (!supportsSuspend(serviceType)) {
    throw new RenderApiError(
      `Render does not support suspending a service of type "${serviceType}".`,
      { code: 'UNSUPPORTED_OPERATION' }
    );
  }
  const { data } = await renderRequest(`/services/${renderServiceId}/suspend`, { method: 'POST' });
  return data;
}

export async function resumeService(renderServiceId, serviceType) {
  if (!supportsSuspend(serviceType)) {
    throw new RenderApiError(
      `Render does not support resuming a service of type "${serviceType}".`,
      { code: 'UNSUPPORTED_OPERATION' }
    );
  }
  const { data } = await renderRequest(`/services/${renderServiceId}/resume`, { method: 'POST' });
  return data;
}

/**
 * Normalize Render's own status vocabulary into ZetaPanel's fixed enum.
 * Render's `service.suspended` / latest deploy `status` fields drive this —
 * we never derive status from which button the user clicked.
 */
export function normalizeStatus({ suspended, latestDeployStatus }) {
  if (suspended === 'suspended') return 'SUSPENDED';
  switch (latestDeployStatus) {
    case 'created':
    case 'queued':
      return 'CREATING';
    case 'build_in_progress':
      return 'BUILDING';
    case 'update_in_progress':
    case 'pre_deploy_in_progress':
      return 'DEPLOYING';
    case 'live':
      return 'ONLINE';
    case 'build_failed':
    case 'update_failed':
    case 'pre_deploy_failed':
    case 'canceled':
    case 'deactivated':
      return 'FAILED';
    default:
      return 'UNKNOWN';
  }
}
