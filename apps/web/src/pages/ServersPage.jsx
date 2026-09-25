import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { Button, Card, StatusBadge, EmptyState, Skeleton } from '../components/ui.jsx';

export default function ServersPage() {
  const [servers, setServers] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    try {
      const d = await api.get('/servers');
      setServers(d.servers);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000); // poll Render-backed status every 10s
    return () => clearInterval(interval);
  }, []);

  async function handleAction(id, action) {
    try {
      if (action === 'restart') await api.post(`/servers/${id}/restart`);
      if (action === 'deploy') await api.post(`/servers/${id}/deploy`);
      if (action === 'delete') {
        if (!confirm('Delete this server? This calls Render to delete the service permanently.')) return;
        await api.delete(`/servers/${id}`);
      }
      load();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Servers</h1>
        <Link to="/servers/new">
          <Button>+ Create Server</Button>
        </Link>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {!servers && !error && <Skeleton className="h-40" />}

      {servers?.length === 0 && (
        <EmptyState
          title="No servers yet"
          description="Create your first server — ZetaPanel will provision a real Render service."
          action={
            <Link to="/servers/new">
              <Button>+ Create Server</Button>
            </Link>
          }
        />
      )}

      {servers?.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-panel-border text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Runtime</th>
                <th className="px-4 py-3">Region</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {servers.map((s) => (
                <tr key={s.id} className="border-b border-panel-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <Link to={`/servers/${s.id}`} className="text-slate-100 hover:text-panel-accent">
                      {s.name}
                    </Link>
                    <p className="text-xs text-slate-500">{s.renderServiceId || 'provisioning…'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-400">{s.runtime}</td>
                  <td className="px-4 py-3 text-slate-400">{s.region}</td>
                  <td className="px-4 py-3 text-slate-400">{s.plan}</td>
                  <td className="px-4 py-3 text-slate-400">{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => handleAction(s.id, 'deploy')}>Deploy</Button>
                      <Button variant="ghost" onClick={() => handleAction(s.id, 'restart')}>Restart</Button>
                      <Button variant="danger" onClick={() => handleAction(s.id, 'delete')}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
