import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { Button, Card, Skeleton } from '../../components/ui.jsx';

export default function AdminUsers() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    try {
      const d = await api.get('/admin/users');
      setUsers(d.users);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleSuspend(user) {
    await api.patch(`/admin/users/${user.id}/suspend`, { suspended: !user.suspended });
    load();
  }

  async function removeUser(user) {
    if (!confirm(`Delete user ${user.email}? This deletes all their servers' metadata too.`)) return;
    try {
      await api.delete(`/admin/users/${user.id}`);
      load();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <Card className="p-0 overflow-hidden">
      {error && <p className="p-4 text-sm text-red-400">{error}</p>}
      {!users && !error && <Skeleton className="h-40 m-4" />}
      {users && (
        <table className="w-full text-sm">
          <thead className="border-b border-panel-border text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Servers</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-panel-border/50 last:border-0">
                <td className="px-4 py-3 text-slate-200">{u.email}</td>
                <td className="px-4 py-3 text-slate-400">{u.role}</td>
                <td className="px-4 py-3 text-slate-400">{u._count.servers} / {u.maxServers}</td>
                <td className="px-4 py-3">{u.suspended ? <span className="text-red-400">Suspended</span> : <span className="text-emerald-400">Active</span>}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => toggleSuspend(u)}>{u.suspended ? 'Unsuspend' : 'Suspend'}</Button>
                    <Button variant="danger" onClick={() => removeUser(u)}>Delete</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
