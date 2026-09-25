import { prisma } from '../utils/prisma.js';
import { logActivity } from '../utils/activity.js';
import { createServerSchema, updateStartupSchema } from '../validators/schemas.js';
import {
  createService,
  getService,
  updateService,
  deleteService,
  restartService,
  buildCreateServicePayload,
  buildR2BridgeServicePayload,
  normalizeStatus,
} from '../services/render/renderServices.js';
import { triggerDeploy, listDeploys, getDeploy } from '../services/render/renderDeployments.js';
import { getServiceLogs } from '../services/render/renderLogs.js';
import { listEnvVars, upsertEnvVar, deleteEnvVar } from '../services/render/renderEnvironment.js';
import { deleteFolder } from '../services/storage/r2Files.js';
import { RenderApiError } from '../services/render/renderClient.js';

async function assertOwnership(req, serverId) {
  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server) {
    const err = new Error('Server not found.');
    err.status = 404;
    throw err;
  }
  const isOwner = server.userId === req.user.id;
  const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';
  if (!isOwner && !isAdmin) {
    const err = new Error('You do not have permission to perform this action.');
    err.status = 403;
    throw err;
  }
  return server;
}

/** Merge our DB row with Render's live view of the service (source of truth for status). */
async function withLiveStatus(server) {
  if (!server.renderServiceId) return { ...server, status: 'CREATING', renderStatus: null };
  try {
    const render = await getService(server.renderServiceId);
    const status = normalizeStatus({
      suspended: render.suspended,
      latestDeployStatus: render.serviceDetails?.deployStatus || render.latestDeploy?.status,
    });
    if (status !== server.status) {
      await prisma.server.update({ where: { id: server.id }, data: { status, renderStatus: render.suspended || render.latestDeploy?.status } });
    }
    return { ...server, status, renderStatus: render.suspended || render.latestDeploy?.status, renderUrl: render.serviceDetails?.url };
  } catch (err) {
    if (err instanceof RenderApiError) {
      return { ...server, status: 'UNKNOWN', renderError: err.message };
    }
    throw err;
  }
}

export async function createServer(req, res, next) {
  try {
    const input = createServerSchema.parse(req.body);

    const count = await prisma.server.count({ where: { userId: req.user.id } });
    if (count >= req.user.maxServers) {
      return res.status(403).json({ error: { message: `You have reached your plan's limit of ${req.user.maxServers} servers.` } });
    }

    // Create the DB row first so we have a stable server.id to scope the R2
    // prefix and (for r2_zip) tell the runtime bridge where to sync from.
    const server = await prisma.server.create({
      data: {
        userId: req.user.id,
        name: input.name,
        runtime: input.runtime,
        serviceType: input.serviceType,
        region: input.region,
        plan: input.plan,
        deploymentSource: input.deploymentSource,
        repository: input.repository,
        branch: input.branch,
        buildCommand: input.buildCommand,
        startCommand: input.startCommand,
        preDeployCommand: input.preDeployCommand,
        autoDeploy: input.autoDeploy,
        healthCheckPath: input.healthCheckPath,
        status: 'CREATING',
        r2Prefix: '',
      },
    });

    const r2Prefix = `users/${req.user.id}/servers/${server.id}/files/`;
    await prisma.server.update({ where: { id: server.id }, data: { r2Prefix } });

    let payload;
    if (input.deploymentSource === 'r2_zip') {
      const runtimeRepo = process.env.ZETAPANEL_RUNTIME_REPO;
      payload = buildR2BridgeServicePayload({
        name: input.name,
        serviceType: input.serviceType,
        region: input.region,
        plan: input.plan,
        autoDeploy: input.autoDeploy,
        branch: process.env.ZETAPANEL_RUNTIME_BRANCH || 'main',
        runtimeRepo,
        buildCommand: input.buildCommand,
        startCommand: input.startCommand,
        r2: {
          accountId: process.env.R2_ACCOUNT_ID,
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
          bucket: process.env.R2_BUCKET,
          prefix: r2Prefix,
        },
        envVars: input.envVars,
      });
    } else {
      payload = buildCreateServicePayload({
        name: input.name,
        serviceType: input.serviceType,
        runtime: input.runtime,
        repo: input.repository,
        branch: input.branch,
        buildCommand: input.buildCommand,
        startCommand: input.startCommand,
        preDeployCommand: input.preDeployCommand,
        region: input.region,
        plan: input.plan,
        autoDeploy: input.autoDeploy,
        healthCheckPath: input.healthCheckPath,
        envVars: input.envVars,
      });
    }

    let renderService;
    try {
      renderService = await createService(payload);
    } catch (err) {
      // Don't leave an orphaned DB row pointing at nothing on Render.
      await prisma.server.delete({ where: { id: server.id } }).catch(() => {});
      throw err;
    }

    const updated = await prisma.server.update({
      where: { id: server.id },
      data: { renderServiceId: renderService.id },
    });

    await logActivity({ userId: req.user.id, action: 'server.created', metadata: { serverId: server.id, name: server.name, deploymentSource: input.deploymentSource }, ip: req.ip });

    res.status(201).json({ server: await withLiveStatus(updated) });
  } catch (err) {
    next(err);
  }
}

export async function listServers(req, res, next) {
  try {
    const where = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN' ? {} : { userId: req.user.id };
    const servers = await prisma.server.findMany({ where, orderBy: { createdAt: 'desc' } });
    const withStatus = await Promise.all(servers.map(withLiveStatus));
    res.json({ servers: withStatus });
  } catch (err) {
    next(err);
  }
}

export async function getServer(req, res, next) {
  try {
    const server = await assertOwnership(req, req.params.id);
    res.json({ server: await withLiveStatus(server) });
  } catch (err) {
    next(err);
  }
}

export async function updateStartup(req, res, next) {
  try {
    const server = await assertOwnership(req, req.params.id);
    const input = updateStartupSchema.parse(req.body);

    if (!server.renderServiceId) {
      return res.status(409).json({ error: { message: 'This server has no linked Render service yet.' } });
    }

    const patch = {};
    if (input.branch) patch.branch = input.branch;
    if (input.autoDeploy !== undefined) patch.autoDeploy = input.autoDeploy ? 'yes' : 'no';
    if (input.buildCommand || input.startCommand || input.preDeployCommand || input.healthCheckPath) {
      patch.serviceDetails = {};
      if (input.buildCommand || input.startCommand) {
        patch.serviceDetails.envSpecificDetails = {
          buildCommand: input.buildCommand ?? server.buildCommand,
          startCommand: input.startCommand ?? server.startCommand,
        };
      }
      if (input.preDeployCommand) patch.serviceDetails.preDeployCommand = input.preDeployCommand;
      if (input.healthCheckPath) patch.serviceDetails.healthCheckPath = input.healthCheckPath;
    }

    await updateService(server.renderServiceId, patch);

    const updated = await prisma.server.update({
      where: { id: server.id },
      data: {
        branch: input.branch ?? server.branch,
        buildCommand: input.buildCommand ?? server.buildCommand,
        startCommand: input.startCommand ?? server.startCommand,
        preDeployCommand: input.preDeployCommand ?? server.preDeployCommand,
        autoDeploy: input.autoDeploy ?? server.autoDeploy,
        healthCheckPath: input.healthCheckPath ?? server.healthCheckPath,
      },
    });

    await logActivity({ userId: req.user.id, action: 'server.startup_updated', metadata: { serverId: server.id }, ip: req.ip });
    res.json({ server: await withLiveStatus(updated) });
  } catch (err) {
    next(err);
  }
}

export async function deleteServer(req, res, next) {
  try {
    const server = await assertOwnership(req, req.params.id);
    const deleteFiles = req.query.deleteFiles === 'true';

    if (server.renderServiceId) {
      await deleteService(server.renderServiceId); // must succeed before we touch our own DB (rule #10)
    }

    if (deleteFiles) {
      await deleteFolder({ userId: server.userId, serverId: server.id, path: '' }).catch(() => {});
    }

    await prisma.server.delete({ where: { id: server.id } });
    await logActivity({ userId: req.user.id, action: 'server.deleted', metadata: { serverId: server.id, deleteFiles }, ip: req.ip });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function restartServer(req, res, next) {
  try {
    const server = await assertOwnership(req, req.params.id);
    if (!server.renderServiceId) return res.status(409).json({ error: { message: 'No linked Render service.' } });

    await restartService(server.renderServiceId);
    await logActivity({ userId: req.user.id, action: 'server.restarted', metadata: { serverId: server.id }, ip: req.ip });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function deployServer(req, res, next) {
  try {
    const server = await assertOwnership(req, req.params.id);
    if (!server.renderServiceId) return res.status(409).json({ error: { message: 'No linked Render service.' } });

    const deploy = await triggerDeploy(server.renderServiceId, { clearCache: req.body?.clearCache });

    await prisma.deployment.create({
      data: {
        serverId: server.id,
        renderDeployId: deploy.id,
        status: deploy.status,
        commitId: deploy.commit?.id,
        commitMessage: deploy.commit?.message,
        trigger: 'manual',
        startedAt: new Date(),
      },
    });

    await logActivity({ userId: req.user.id, action: 'server.deployed', metadata: { serverId: server.id, deployId: deploy.id }, ip: req.ip });
    res.status(202).json({ deploy });
  } catch (err) {
    next(err);
  }
}

export async function listServerDeployments(req, res, next) {
  try {
    const server = await assertOwnership(req, req.params.id);
    if (!server.renderServiceId) return res.json({ deployments: [] });

    const deploys = await listDeploys(server.renderServiceId, { limit: Number(req.query.limit) || 20 });
    res.json({ deployments: deploys });
  } catch (err) {
    next(err);
  }
}

export async function getServerDeployment(req, res, next) {
  try {
    const server = await assertOwnership(req, req.params.id);
    const deploy = await getDeploy(server.renderServiceId, req.params.deployId);
    res.json({ deploy });
  } catch (err) {
    next(err);
  }
}

export async function getStatus(req, res, next) {
  try {
    const server = await assertOwnership(req, req.params.id);
    const withStatus = await withLiveStatus(server);
    res.json({ status: withStatus.status, renderStatus: withStatus.renderStatus, renderUrl: withStatus.renderUrl });
  } catch (err) {
    next(err);
  }
}

export async function getLogs(req, res, next) {
  try {
    const server = await assertOwnership(req, req.params.id);
    if (!server.renderServiceId) return res.json({ logs: [] });

    const logs = await getServiceLogs(server.renderServiceId, {
      limit: Number(req.query.limit) || 100,
      startTime: req.query.startTime,
      endTime: req.query.endTime,
      direction: req.query.direction,
    });
    res.json(logs);
  } catch (err) {
    next(err);
  }
}

export async function listEnv(req, res, next) {
  try {
    const server = await assertOwnership(req, req.params.id);
    if (!server.renderServiceId) return res.json({ envVars: [] });
    const envVars = await listEnvVars(server.renderServiceId);
    res.json({ envVars });
  } catch (err) {
    next(err);
  }
}

export async function setEnv(req, res, next) {
  try {
    const server = await assertOwnership(req, req.params.id);
    const { key, value } = req.body;
    if (!key || value === undefined) return res.status(400).json({ error: { message: 'key and value are required.' } });

    await upsertEnvVar(server.renderServiceId, key, value);
    await logActivity({ userId: req.user.id, action: 'server.env_changed', metadata: { serverId: server.id, key }, ip: req.ip });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function removeEnv(req, res, next) {
  try {
    const server = await assertOwnership(req, req.params.id);
    await deleteEnvVar(server.renderServiceId, req.params.key);
    await logActivity({ userId: req.user.id, action: 'server.env_removed', metadata: { serverId: server.id, key: req.params.key }, ip: req.ip });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
