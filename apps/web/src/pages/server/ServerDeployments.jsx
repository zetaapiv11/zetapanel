import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { Card, Skeleton } from '../../components/ui.jsx';

export default function ServerDeployments({ server }) {
  const [deploys, setDeploys] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get(`/servers/${server.id}/deployments`)
      .then((d) => setDeploys(d.deployments))
      .catch((e) => setError(e.message));
  }, [server.id]);

  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold text-slate-300">Deployments</h2>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!deploys && !error && <Skeleton className="h-32" />}
      {deploys?.length === 0 && <p className="text-sm text-slate-500">No deployments yet.</p>}
      <div className="space-y-2">
        {deploys?.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-lg border border-panel-border px-3 py-2 text-sm">
            <div>
              <p className="text-slate-200">{d.id}</p>
              <p className="text-xs text-slate-500">
                {d.commit?.message || 'No commit message'} · {d.commit?.id?.slice(0, 7) || ''}
              </p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>{d.status}</p>
              <p>{d.finishedAt ? new Date(d.finishedAt).toLocaleString() : d.startedAt ? new Date(d.startedAt).toLocaleString() : ''}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
