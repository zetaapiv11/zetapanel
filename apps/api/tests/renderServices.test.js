import { describe, it, expect } from 'vitest';
import { buildCreateServicePayload, normalizeStatus, supportsSuspend } from '../src/services/render/renderServices.js';

describe('buildCreateServicePayload', () => {
  it('builds a valid payload for a Node background worker (Discord bot use case)', () => {
    const payload = buildCreateServicePayload({
      name: 'zeechei-bot-v3',
      serviceType: 'background_worker',
      runtime: 'node',
      repo: 'https://github.com/example/zeechei-bot-v3',
      branch: 'main',
      buildCommand: 'npm install',
      startCommand: 'npm start',
      region: 'oregon',
      plan: 'starter',
      autoDeploy: true,
      envVars: [{ key: 'DISCORD_TOKEN', value: 'x' }],
    });

    expect(payload.type).toBe('background_worker');
    expect(payload.autoDeploy).toBe('yes');
    expect(payload.serviceDetails.envSpecificDetails.buildCommand).toBe('npm install');
    expect(payload.serviceDetails.envSpecificDetails.startCommand).toBe('npm start');
    expect(payload.envVars).toEqual([{ key: 'DISCORD_TOKEN', value: 'x' }]);
    // background workers don't get a healthCheckPath
    expect(payload.serviceDetails.healthCheckPath).toBeUndefined();
  });

  it('rejects an unsupported service type instead of silently sending garbage', () => {
    expect(() =>
      buildCreateServicePayload({ name: 'x', serviceType: 'not_a_real_type', repo: 'https://x', region: 'oregon', plan: 'starter' })
    ).toThrow(/Unsupported Render service type/);
  });
});

describe('normalizeStatus', () => {
  it('maps suspended services to SUSPENDED regardless of deploy status', () => {
    expect(normalizeStatus({ suspended: 'suspended', latestDeployStatus: 'live' })).toBe('SUSPENDED');
  });

  it('maps live deploys to ONLINE', () => {
    expect(normalizeStatus({ suspended: 'not_suspended', latestDeployStatus: 'live' })).toBe('ONLINE');
  });

  it('maps unknown deploy statuses to UNKNOWN rather than guessing', () => {
    expect(normalizeStatus({ suspended: 'not_suspended', latestDeployStatus: 'something_new_render_added' })).toBe('UNKNOWN');
  });
});

describe('supportsSuspend', () => {
  it('cron jobs cannot be suspended per Render API', () => {
    expect(supportsSuspend('cron_job')).toBe(false);
  });
  it('web services can be suspended', () => {
    expect(supportsSuspend('web_service')).toBe(true);
  });
});
