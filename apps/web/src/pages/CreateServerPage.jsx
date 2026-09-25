import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { Button, Card, Input } from '../components/ui.jsx';

// Values Render documents today. Verify against your account/API before
// relying on this list long-term — Render adds regions/plans over time,
// and not all plans are available on every service type.
const SERVICE_TYPES = [
  { value: 'web_service', label: 'Web Service' },
  { value: 'background_worker', label: 'Background Worker' },
  { value: 'private_service', label: 'Private Service' },
  { value: 'cron_job', label: 'Cron Job' },
];
const RUNTIMES = ['node', 'python', 'ruby', 'go', 'elixir', 'rust', 'docker'];
const REGIONS = ['oregon', 'ohio', 'virginia', 'frankfurt', 'singapore'];
const PLANS = ['free', 'starter', 'standard', 'pro', 'pro_plus'];

export default function CreateServerPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    serviceType: 'background_worker',
    runtime: 'node',
    region: 'oregon',
    plan: 'starter',
    deploymentSource: 'git',
    repository: '',
    branch: 'main',
    buildCommand: 'npm install',
    startCommand: 'npm start',
    preDeployCommand: '',
    autoDeploy: true,
    healthCheckPath: '',
  });
  const [envVars, setEnvVars] = useState([{ key: '', value: '' }]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function updateEnv(i, field, value) {
    setEnvVars((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        envVars: envVars.filter((e) => e.key.trim()).map((e) => ({ key: e.key.trim(), value: e.value })),
      };
      const { server } = await api.post('/servers', payload);
      navigate(`/servers/${server.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-white">Create Server</h1>
      <p className="text-sm text-slate-500">
        This submits a real request to the Render API to provision a service. Deployment source must be a Git
        repository — see <span className="text-slate-300">Documentation → Uploading Project</span> for why a plain
        ZIP upload can't be deployed directly.
      </p>

      <form onSubmit={onSubmit} className="space-y-6">
        <Card className="space-y-4">
          <Field label="Server Name">
            <Input value={form.name} onChange={(e) => update('name', e.target.value)} required minLength={3} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Service Type">
              <Select value={form.serviceType} onChange={(v) => update('serviceType', v)} options={SERVICE_TYPES.map((t) => [t.value, t.label])} />
            </Field>
            <Field label="Runtime">
              <Select value={form.runtime} onChange={(v) => update('runtime', v)} options={RUNTIMES.map((r) => [r, r])} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Region">
              <Select value={form.region} onChange={(v) => update('region', v)} options={REGIONS.map((r) => [r, r])} />
            </Field>
            <Field label="Plan">
              <Select value={form.plan} onChange={(v) => update('plan', v)} options={PLANS.map((p) => [p, p])} />
            </Field>
          </div>
        </Card>

        <Card className="space-y-4">
          <Field label="Deployment Source">
            <Select
              value={form.deploymentSource}
              onChange={(v) => update('deploymentSource', v)}
              options={[
                ['git', 'Git Repository'],
                ['r2_zip', 'Upload ZIP (via File Manager)'],
              ]}
            />
          </Field>

          {form.deploymentSource === 'git' ? (
            <>
              <Field label="Repository (Git URL)">
                <Input
                  placeholder="https://github.com/you/your-discord-bot"
                  value={form.repository}
                  onChange={(e) => update('repository', e.target.value)}
                  required
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Branch">
                  <Input value={form.branch} onChange={(e) => update('branch', e.target.value)} />
                </Field>
                <Field label="Auto Deploy">
                  <Select value={form.autoDeploy ? 'on' : 'off'} onChange={(v) => update('autoDeploy', v === 'on')} options={[['on', 'ON'], ['off', 'OFF']]} />
                </Field>
              </div>
            </>
          ) : (
            <p className="rounded-lg border border-panel-border bg-black/20 p-3 text-xs text-slate-400">
              After creating this server, go to its <strong>Files</strong> tab and upload your project ZIP (it'll be
              extracted automatically), then hit <strong>Deploy</strong> to sync it into the running container. The
              server will fail to start until files are uploaded — that's expected, not a bug.
            </p>
          )}

          <Field label="Build Command (optional)">
            <Input value={form.buildCommand} onChange={(e) => update('buildCommand', e.target.value)} placeholder="npm install" />
          </Field>
          <Field label="Start Command">
            <Input value={form.startCommand} onChange={(e) => update('startCommand', e.target.value)} required placeholder="npm start" />
          </Field>
          {form.deploymentSource === 'git' && (
            <Field label="Pre-Deploy Command (optional)">
              <Input value={form.preDeployCommand} onChange={(e) => update('preDeployCommand', e.target.value)} />
            </Field>
          )}
          {form.deploymentSource === 'git' && (form.serviceType === 'web_service' || form.serviceType === 'private_service') && (
            <Field label="Health Check Path (optional)">
              <Input placeholder="/health" value={form.healthCheckPath} onChange={(e) => update('healthCheckPath', e.target.value)} />
            </Field>
          )}
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">Environment Variables</h2>
            <Button type="button" variant="ghost" onClick={() => setEnvVars((p) => [...p, { key: '', value: '' }])}>
              + Add Variable
            </Button>
          </div>
          {envVars.map((env, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <Input placeholder="KEY (e.g. DISCORD_TOKEN)" value={env.key} onChange={(e) => updateEnv(i, 'key', e.target.value)} />
              <Input placeholder="value" value={env.value} onChange={(e) => updateEnv(i, 'value', e.target.value)} />
            </div>
          ))}
        </Card>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating on Render…' : 'Create Server'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-panel-border bg-black/20 px-3 py-2 text-sm text-slate-100 focus:border-panel-accent focus:outline-none"
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
