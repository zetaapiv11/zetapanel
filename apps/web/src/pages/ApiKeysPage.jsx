import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { Button, Card, Input, Skeleton } from '../components/ui.jsx';

const ALL_PERMISSIONS = [
  'servers.read', 'servers.create', 'servers.update', 'servers.delete',
  'servers.deploy', 'servers.restart', 'servers.logs', 'servers.env',
  'files.read', 'files.write',
];

export default function ApiKeysPage() {
  const [keys, setKeys] = useState(null);
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState(['servers.read']);
  const [freshKey, setFreshKey] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    try {
      const d = await api.get('/api-keys');
      setKeys(d.apiKeys);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function togglePermission(p) {
    setPermissions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function createKey(e) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.post('/api-keys', { name, permissions });
      setFreshKey(res.key);
      setName('');
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function revoke(id) {
    if (!confirm('Revoke this API key? Requests using it will start failing immediately.')) return;
    await api.delete(`/api-keys/${id}`);
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-white">API Keys</h1>

      {freshKey && (
        <Card className="border-emerald-700/50 bg-emerald-950/20">
          <p className="text-sm text-emerald-300">
            Your new API key (shown only once — copy it now):
          </p>
          <code className="mt-2 block break-all rounded bg-black/40 p-2 text-xs text-emerald-200">{freshKey}</code>
          <Button variant="ghost" className="mt-2" onClick={() => setFreshKey(null)}>Dismiss</Button>
        </Card>
      )}

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-300">Create a new key</h2>
        <form onSubmit={createKey} className="space-y-3">
          <Input placeholder="Name (e.g. My Bot API)" value={name} onChange={(e) => setName(e.target.value)} required />
          <div className="flex flex-wrap gap-2">
            {ALL_PERMISSIONS.map((p) => (
              <label key={p} className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${permissions.includes(p) ? 'border-panel-accent bg-panel-accent/10 text-panel-accent' : 'border-panel-border text-slate-400'}`}>
                <input type="checkbox" className="hidden" checked={permissions.includes(p)} onChange={() => togglePermission(p)} />
                {p}
              </label>
            ))}
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit">Create API Key</Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-300">Existing keys</h2>
        {!keys && <Skeleton className="h-24" />}
        {keys?.length === 0 && <p className="text-sm text-slate-500">No API keys yet.</p>}
        <div className="space-y-2">
          {keys?.map((k) => (
            <div key={k.id} className="flex items-center justify-between rounded-lg border border-panel-border px-3 py-2 text-sm">
              <div>
                <p className="text-slate-200">{k.name} {k.revokedAt && <span className="text-xs text-red-400">(revoked)</span>}</p>
                <p className="text-xs text-slate-500 font-mono">{k.keyPrefix}••••••••</p>
                <p className="text-xs text-slate-600">{k.permissions.join(', ')}</p>
              </div>
              {!k.revokedAt && (
                <button className="text-xs text-red-400 hover:text-red-300" onClick={() => revoke(k.id)}>Revoke</button>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
