import { useState } from 'react';
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
  const [open, setOpen] = useState(false);

  const linkClass = ({ isActive }) =>
    `block rounded-lg px-3 py-2 text-sm ${
      isActive ? 'bg-panel-accent/15 text-panel-accent' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
    }`;

  return (
    <div className="flex h-screen bg-panel-bg overflow-hidden">
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-panel-border bg-panel-surface px-4 py-3 md:hidden">
        <div className="text-lg font-semibold text-white">
          Zeta<span className="text-panel-accent">Panel</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg border border-panel-border p-2 text-slate-300"
          aria-label="Open menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </div>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar: off-canvas on mobile, static on desktop */}
      <aside
        className={`fixed z-50 h-full w-64 shrink-0 border-r border-panel-border bg-panel-surface p-4 flex flex-col transition-transform duration-200 md:static md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-8 flex items-center justify-between px-2">
          <span className="text-lg font-semibold text-white">
            Zeta<span className="text-panel-accent">Panel</span>
          </span>
          <button className="text-slate-400 md:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            ✕
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass} onClick={() => setOpen(false)}>
              {item.label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink to="/admin" className={linkClass} onClick={() => setOpen(false)}>
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

      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        <div className="mx-auto max-w-6xl p-4 sm:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
