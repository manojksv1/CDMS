import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useSettingsStore } from './store/settingsStore';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Implementations from './pages/Implementations';
import ImplementationDetail from './pages/ImplementationDetail';
import MilestoneTemplate from './pages/MilestoneTemplate';
import Users from './pages/Users';
import ErrorBoundary from './components/ErrorBoundary';
import api from './api';
import type { AuthUser, AppSettings } from './types/api';

// ---------------------------------------------------------------------------
// Auth + app settings initialisation on every app load
// ---------------------------------------------------------------------------
function AuthInitialiser({ children }: { children: React.ReactNode }) {
  const setInitialised = useAuthStore((s) => s.setInitialised);
  const setAppTimezone = useSettingsStore((s) => s.setAppTimezone);

  useEffect(() => {
    api
      .get<AuthUser>('/users/me')
      .then((res) => {
        setInitialised(res.data);
        // Fetch app-level settings after auth succeeds
        return api.get<AppSettings>('/system/settings');
      })
      .then((res) => setAppTimezone(res.data.app_timezone))
      .catch(() => setInitialised(null));
  }, [setInitialised, setAppTimezone]);

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Route guards
// ---------------------------------------------------------------------------
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isInitialised } = useAuthStore();

  if (!isInitialised) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function DashboardRedirect() {
  const user = useAuthStore((s) => s.user);
  if (user?.role === 'ENGINEER') return <Navigate to="/implementations" replace />;
  return <Dashboard />;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthInitialiser>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardRedirect />} />
              <Route path="implementations" element={<Implementations />} />
              <Route path="implementations/:id" element={<ImplementationDetail />} />
              <Route path="implementations/template" element={<MilestoneTemplate />} />
              <Route path="clients" element={<Clients />} />
              <Route path="users" element={<Users />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthInitialiser>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
