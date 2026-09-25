import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { Button, Card, Input, Skeleton } from '../../components/ui.jsx';

export default function ServerEnvironment({ server }) {
  const [envVars, setEnvVars] = useState(null);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [revealed, setRevealed] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const data = await api.get(`/servers/${server.id}/env`);
      setEnvVars(data.envVars || []);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.id]);

  async function addVar(e) {
    e.preventDefault();
    if (!newKey.trim()) return;
    setSaving(true);
    try {
      await api.post(`/servers/${server.id}/env`, { key: newKey.trim(), value: newValue });
      setNewKey('');
      setNewValue('');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeVar(key) {
    if (!confirm(`Delete env var "${key}"? Render may trigger a redeploy.`)) return;
    try {
      await api.delete(`/servers/${server.id}/env/${encodeURIComponent(key)}`);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-300">Environment Variables</h2>
        <p className="text-xs text-slate-500">Changes are sent directly to Render and may trigger a redeploy.</p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {!envVars && <Skeleton className="h-24" />}

      {envVars && (
        <div className="space-y-2">
          {envVars.length === 0 && <p className="text-sm text-slate-500">No environment variables set.</p>}
          {envVars.map((v) => (
            <div key={v.key} className="flex items-center gap-2 rounded-lg border border-panel-border px-3 py-2">
              <span className="w-40 shrink-0 truncate text-sm text-slate-200">{v.key}</span>
              <span className="flex-1 truncate font-mono text-xs text-slate-500">
                {revealed[v.key] ? v.value : '••••••••••••'}
              </span>
              <button
                className="text-xs text-slate-400 hover:text-panel-accent"
                onClick={() => setRevealed((r) => ({ ...r, [v.key]: !r[v.key] }))}
              >
                {revealed[v.key] ? 'Hide' : 'Reveal'}
              </button>
              <button
                className="text-xs text-slate-400 hover:text-panel-accent"
                onClick={() => navigator.clipboard.writeText(v.value)}
              >
                Copy
              </button>
              <button className="text-xs text-red-400 hover:text-red-300" onClick={() => removeVar(v.key)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={addVar} className="grid grid-cols-[1fr,1fr,auto] gap-2 pt-2">
        <Input placeholder="KEY" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
        <Input placeholder="value" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
        <Button type="submit" disabled={saving}>
          Add
        </Button>
      </form>
    </Card>
  );
}
