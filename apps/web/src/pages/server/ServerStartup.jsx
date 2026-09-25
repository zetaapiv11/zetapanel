import { useState } from 'react';
import { api } from '../../services/api.js';
import { Button, Card, Input } from '../../components/ui.jsx';

export default function ServerStartup({ server, onUpdated }) {
  const [form, setForm] = useState({
    branch: server.branch || 'main',
    buildCommand: server.buildCommand || '',
    startCommand: server.startCommand || '',
    preDeployCommand: server.preDeployCommand || '',
    autoDeploy: server.autoDeploy,
    healthCheckPath: server.healthCheckPath || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setSuccess(false);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { server: updated } = await api.patch(`/servers/${server.id}/startup`, form);
      onUpdated?.(updated);
      setSuccess(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-xl space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-300">Startup Configuration</h2>
        <p className="text-xs text-slate-500">Saving pushes a real PATCH to the Render service.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Branch">
          <Input value={form.branch} onChange={(e) => update('branch', e.target.value)} />
        </Field>
        <Field label="Build Command">
          <Input value={form.buildCommand} onChange={(e) => update('buildCommand', e.target.value)} />
        </Field>
        <Field label="Start Command">
          <Input value={form.startCommand} onChange={(e) => update('startCommand', e.target.value)} />
        </Field>
        <Field label="Pre-Deploy Command">
          <Input value={form.preDeployCommand} onChange={(e) => update('preDeployCommand', e.target.value)} />
        </Field>
        <Field label="Health Check Path">
          <Input value={form.healthCheckPath} onChange={(e) => update('healthCheckPath', e.target.value)} placeholder="/health" />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={form.autoDeploy} onChange={(e) => update('autoDeploy', e.target.checked)} />
          Auto Deploy
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-emerald-400">Saved and synced to Render.</p>}

        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </form>
    </Card>
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
