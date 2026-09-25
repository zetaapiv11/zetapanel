import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { Card, Skeleton } from '../components/ui.jsx';

export default function ActivityPage() {
  const [activity, setActivity] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Regular users see only their own activity because the backend scopes
    // /servers etc. by ownership; a dedicated /api/activity (self) endpoint
    // can be added the same way as /api/admin/activity if needed.
    api
      .get('/admin/activity')
      .then((d) => setActivity(d.activity))
      .catch(() => setActivity([]));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-white">Activity</h1>
      <Card>
        {!activity && !error && <Skeleton className="h-40" />}
        {activity?.length === 0 && <p className="text-sm text-slate-500">No activity recorded yet.</p>}
        <div className="space-y-2">
          {activity?.map((a) => (
            <div key={a.id} className="flex items-center justify-between border-b border-panel-border/50 py-2 text-sm last:border-0">
              <div>
                <span className="text-slate-200">{a.user?.email || 'system'}</span>{' '}
                <span className="text-slate-500">{a.action}</span>
              </div>
              <span className="text-xs text-slate-600">{new Date(a.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
