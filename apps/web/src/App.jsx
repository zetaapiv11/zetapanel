import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore.js';

import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ServersPage from './pages/ServersPage.jsx';
import CreateServerPage from './pages/CreateServerPage.jsx';
import ServerDetailPage from './pages/ServerDetailPage.jsx';
import ApiKeysPage from './pages/ApiKeysPage.jsx';
import ActivityPage from './pages/ActivityPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import DocsPage from './pages/DocsPage.jsx';

function RequireAuth({ children }) {
  const { user, initialized } = useAuthStore();
  if (!initialized) return <FullscreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { user } = useAuthStore();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) return <Navigate to="/" replace />;
  return children;
}

function FullscreenLoader() {
  return <div className="flex h-screen items-center justify-center text-slate-400">Memuat ZetaPanel…</div>;
}

export default function App() {
  const refresh = useAuthStore((s) => s.refresh);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/docs" element={<DocsPage />} />

      <Route
        path="/"
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="servers" element={<ServersPage />} />
        <Route path="servers/new" element={<CreateServerPage />} />
        <Route path="servers/:id/*" element={<ServerDetailPage />} />
        <Route path="api-keys" element={<ApiKeysPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route
          path="admin/*"
          element={
            <RequireAdmin>
              <AdminPage />
            </RequireAdmin>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
