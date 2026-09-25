import { NavLink, Route, Routes } from 'react-router-dom';
import AdminOverview from './admin/AdminOverview.jsx';
import AdminUsers from './admin/AdminUsers.jsx';
import AdminRenderSettings from './admin/AdminRenderSettings.jsx';

const TABS = [
  { to: '', label: 'Overview', end: true },
  { to: 'users', label: 'Users' },
  { to: 'render', label: 'Render Connection' },
];

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-white">Admin</h1>

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
        <Route index element={<AdminOverview />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="render" element={<AdminRenderSettings />} />
      </Routes>
    </div>
  );
}
