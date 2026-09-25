import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.js';

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/servers', label: 'Servers' },
  { to: '/api-keys', label: 'API Keys' },
  { to: '/activity', label: 'Activity' },
  { to: '/docs', label: 'Documentation' },
];

export default function DashboardLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  return (
    <div className="flex h-screen bg-panel-bg">
      <aside className="w-60 shrink-0 border-r border-panel-border bg-panel-surface p-4 flex flex-col">
        <div className="mb-8 px-2 text-lg font-semibold text-white">
          Zeta<span className="text-panel-accent">Panel</span>
        </div>
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm ${
                  isActive ? 'bg-panel-accent/15 text-panel-accent' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm ${
                  isActive ? 'bg-panel-accent/15 text-panel-accent' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`
              }
            >
              Admin
            </NavLink>
          )}
        </nav>
        <div className="border-t border-panel-border pt-3 text-xs text-slate-500">
          <div className="truncate">{user?.email}</div>
          <button
            className="mt-2 text-slate-400 hover:text-red-400"
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
