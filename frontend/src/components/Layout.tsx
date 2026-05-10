import React from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { useAuthStore } from '../store/authStore';
import {
  LayoutDashboard,
  Users,
  LogOut,
  Shield,
  ClipboardList,
  Wrench,
} from 'lucide-react';
import Notification from './Notification';
import { motion } from 'framer-motion';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/clients': 'Installation Tracker',
  '/implementations': 'Implementation Tracker',
  '/implementations/template': 'Milestone Template',
  '/users': 'User Management',
};

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/implementations/') && pathname !== '/implementations/template') {
    return 'Implementation Detail';
  }
  return PAGE_TITLES[pathname] ?? 'CDMS';
}

const Layout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore — clear local state regardless
    } finally {
      logout();
      navigate('/login');
    }
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
      isActive
        ? 'bg-blue-700 text-white shadow-sm'
        : 'text-gray-300 hover:bg-white/10 hover:text-white'
    }`;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Notification />

      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-gray-900 flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Shield size={18} className="text-white" />
          </div>
          <span className="text-white font-bold text-base tracking-tight">CDMS Tracker</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {user?.role !== 'ENGINEER' && (
            <NavLink to="/" end className={navLinkClass}>
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </NavLink>
          )}

          {(user?.software_access === 'BOTH' || user?.software_access === 'IMPLEMENTATION') && (
            <NavLink to="/implementations" className={navLinkClass}>
              <ClipboardList size={18} />
              <span>Implementation</span>
            </NavLink>
          )}

          {user?.role !== 'ENGINEER' &&
            (user?.software_access === 'BOTH' || user?.software_access === 'IMPLEMENTATION') && (
              <NavLink to="/implementations/template" className={navLinkClass}>
                <Wrench size={18} />
                <span>Milestone Template</span>
              </NavLink>
            )}

          {(user?.software_access === 'BOTH' || user?.software_access === 'INSTALLATION') && (
            <NavLink to="/clients" className={navLinkClass}>
              <Users size={18} />
              <span>Installation</span>
            </NavLink>
          )}

          {user?.role !== 'ENGINEER' && (
            <NavLink to="/users" className={navLinkClass}>
              <Users size={18} />
              <span>Users</span>
            </NavLink>
          )}
        </nav>

        {/* User footer — removed, user info moved to top header */}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <h1 className="text-lg font-semibold text-gray-900">
            {getPageTitle(location.pathname)}
          </h1>
          <div className="flex items-center gap-3">

            {/* User info */}
            <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block leading-tight">
                <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-400">{user?.role}</p>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors"
              aria-label="Logout"
              title="Logout"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="p-6 max-w-screen-2xl mx-auto"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
