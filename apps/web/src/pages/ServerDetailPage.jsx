import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api.js';
import { Button, StatusBadge, Skeleton } from '../components/ui.jsx';
import ServerConsole from './server/ServerConsole.jsx';
import ServerFiles from './server/ServerFiles.jsx';
import ServerStartup from './server/ServerStartup.jsx';
import ServerEnvironment from './server/ServerEnvironment.jsx';
import ServerDeployments from './server/ServerDeployments.jsx';
import ServerSettings from './server/ServerSettings.jsx';

const TABS = [
  { to: '', label: 'Console', end: true },
  { to: 'files', label: 'Files' },
  { to: 'startup', label: 'Startup' },
  { to: 'environment', label: 'Environment' },
  { to: 'deployments', label: 'Deployments' },
  { to: 'settings', label: 'Settings' },
];

export default function ServerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [server, setServer] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    try {
      const data = await api.get(`/servers/${id}`);
      setServer(data.server);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function quickAction(action) {
    try {
      if (action === 'deploy') await api.post(`/servers/${id}/deploy`);
      if (action === 'restart') await api.post(`/servers/${id}/restart`);
      load();
    } catch (e) {
      alert(e.message);
    }
  }

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!server) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button className="text-xs text-slate-500 hover:text-panel-accent" onClick={() => navigate('/servers')}>
            ← Back to Servers
          </button>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white">{server.name}</h1>
            <StatusBadge status={server.status} />
          </div>
          <p className="text-xs text-slate-500">
            {server.runtime} · {server.region} · {server.plan}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => quickAction('deploy')}>Deploy</Button>
          <Button variant="ghost" onClick={() => quickAction('restart')}>Restart</Button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-panel-border">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `px-3 py-2 text-sm ${isActive ? 'border-b-2 border-panel-accent text-panel-accent' : 'text-slate-500 hover:text-slate-300'}`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>

      <Routes>
        <Route index element={<ServerConsole server={server} />} />
        <Route path="files" element={<ServerFiles server={server} />} />
        <Route path="startup" element={<ServerStartup server={server} onUpdated={setServer} />} />
        <Route path="environment" element={<ServerEnvironment server={server} />} />
        <Route path="deployments" element={<ServerDeployments server={server} />} />
        <Route path="settings" element={<ServerSettings server={server} />} />
      </Routes>
    </div>
  );
}
