import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { Card, StatusBadge, Skeleton } from '../components/ui.jsx';

export default function DashboardPage() {
  const [servers, setServers] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get('/servers')
      .then((d) => setServers(d.servers))
      .catch((e) => setError(e.message));
  }, []);

  const total = servers?.length ?? 0;
  const running = servers?.filter((s) => s.status === 'ONLINE').length ?? 0;
  const failed = servers?.filter((s) => ['FAILED', 'SUSPENDED', 'UNKNOWN'].includes(s.status)).length ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-white">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Servers" value={total} loading={!servers} />
        <StatCard label="Running" value={running} loading={!servers} />
        <StatCard label="Stopped / Failed" value={failed} loading={!servers} />
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-slate-300">Recent Servers</h2>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {!servers && !error && <Skeleton className="h-24" />}
        {servers?.length === 0 && <p className="text-sm text-slate-500">No servers yet — create your first one.</p>}
        <div className="space-y-2">
          {servers?.slice(0, 5).map((s) => (
            <Link
              key={s.id}
              to={`/servers/${s.id}`}
              className="flex items-center justify-between rounded-lg border border-panel-border px-3 py-2 hover:border-panel-accent/50"
            >
              <div>
                <p className="text-sm text-slate-100">{s.name}</p>
                <p className="text-xs text-slate-500">
                  {s.runtime} · {s.region}
                </p>
              </div>
              <StatusBadge status={s.status} />
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

function StatCard({ label, value, loading }) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      {loading ? <Skeleton className="mt-2 h-7 w-12" /> : <p className="mt-1 text-2xl font-semibold text-white">{value}</p>}
    </Card>
  );
}
