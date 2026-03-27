import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Implementations from './pages/Implementations';
import ImplementationDetail from './pages/ImplementationDetail';
import MilestoneTemplate from './pages/MilestoneTemplate';
import Users from './pages/Users';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const user = useAuthStore((state) => state.user);
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

// Dashboard Access Redirect
const DashboardRedirect = () => {
  const user = useAuthStore((state) => state.user);
  if (user?.role === 'ENGINEER') {
    return <Navigate to="/implementations" replace />;
  }
  return <Dashboard />;
};

function App() {
  return (
    <BrowserRouter>
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
      </Routes>
    </BrowserRouter>
  );
}

export default App;
