import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { Card, Skeleton } from '../../components/ui.jsx';

export default function AdminOverview() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get('/admin/overview').then(setData).catch(() => {});
  }, []);

  if (!data) return <Skeleton className="h-32" />;

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card>
        <p className="text-xs uppercase text-slate-500">Users</p>
        <p className="mt-1 text-2xl font-semibold text-white">{data.userCount}</p>
      </Card>
      <Card>
        <p className="text-xs uppercase text-slate-500">Servers</p>
        <p className="mt-1 text-2xl font-semibold text-white">{data.serverCount}</p>
      </Card>
      <Card>
        <p className="text-xs uppercase text-slate-500">Active API Keys</p>
        <p className="mt-1 text-2xl font-semibold text-white">{data.apiKeyCount}</p>
      </Card>
      <Card className="col-span-3">
        <p className="mb-2 text-xs uppercase text-slate-500">Servers by status</p>
        <div className="flex flex-wrap gap-3 text-sm text-slate-300">
          {data.statusBreakdown?.map((s) => (
            <span key={s.status} className="rounded-full border border-panel-border px-3 py-1">
              {s.status}: {s._count}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}
