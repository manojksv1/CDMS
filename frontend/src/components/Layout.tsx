import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuthStore } from '../store/authStore';
import { LayoutDashboard, Users, LogOut, Shield, ClipboardList, Wrench } from 'lucide-react';
import Notification from './Notification';
import './Layout.css';

const Layout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout failed', err);
    } finally {
      logout();
      navigate('/login');
    }
  };

  return (
    <div className="app-container">
      <Notification />
      <aside className="sidebar">
        <div className="sidebar-header">
          <Shield className="logo-icon" size={24} />
          <h2>CDMS Tracker</h2>
        </div>
        
        <nav className="sidebar-nav">
          <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </NavLink>

          {(user?.software_access === 'BOTH' || user?.software_access === 'IMPLEMENTATION') && (
            <NavLink to="/implementations" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <ClipboardList size={20} />
              <span>Implementations</span>
            </NavLink>
          )}

          {user?.role !== 'ENGINEER' && (user?.software_access === 'BOTH' || user?.software_access === 'IMPLEMENTATION') && (
            <NavLink to="/implementations/template" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Wrench size={20} />
              <span>Milestone Template</span>
            </NavLink>
          )}
          
          {user?.role !== 'ENGINEER' && (user?.software_access === 'BOTH' || user?.software_access === 'INSTALLATION') && (
            <NavLink to="/clients" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Users size={20} />
              <span>Clients</span>
            </NavLink>
          )}
          
          {user?.role !== 'ENGINEER' && (
            <NavLink to="/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Users size={20} />
              <span>Users</span>
            </NavLink>
          )}
        </nav>
      </aside>
      
      <main className="main-content">
        <header className="top-header">
          <div className="header-title">
            <h1>Installation Tracking</h1>
          </div>
          <div className="user-profile">
            <div className="user-info">
              <span className="user-name">{user?.name}</span>
              <span className="user-role">{user?.role}</span>
            </div>
            <button className="logout-button" onClick={handleLogout} title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        
        <div className="content-wrapper">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
