import React, { useEffect, useState, useRef } from 'react';
import api from '../api';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { Plus, X, Trash2, Database, Upload, Download, Edit2, ShieldAlert } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

const Users: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const currentUser = useAuthStore(state => state.user);
  const showNotification = useNotificationStore(state => state.show);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  // Confirmation states
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning' | 'info';
    confirmText: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'warning',
    confirmText: 'Confirm'
  });
  
  const [formData, setFormData] = useState({ name: '', role: 'ENGINEER', software_access: 'BOTH', password: '', timezone: 'UTC' });
  const [editFormData, setEditFormData] = useState({ name: '', role: 'ENGINEER', software_access: 'BOTH', password: '', timezone: 'UTC' });
  
  const commonTimezones = [
    { value: 'UTC', label: 'UTC (GMT)' },
    { value: 'Asia/Kolkata', label: 'IST (India - GMT+5:30)' },
    { value: 'America/New_York', label: 'EST (New York - GMT-5)' },
    { value: 'Europe/London', label: 'GMT/BST (London)' },
    { value: 'Asia/Dubai', label: 'GST (Dubai - GMT+4)' },
    { value: 'Singapore', label: 'SGT (Singapore - GMT+8)' },
  ];
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMaintenanceActive, setIsMaintenanceActive] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users/');
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBackup = async () => {
    setIsMaintenanceActive(true);
    try {
      const response = await api.get('/system/backup', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `cdms_full_backup_${new Date().toISOString().split('T')[0]}.sql`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showNotification("Backup downloaded successfully!", "success");
    } catch (err) {
      console.error(err);
    } finally {
      setIsMaintenanceActive(false);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setConfirmConfig({
      isOpen: true,
      title: 'Restore Database',
      message: 'WARNING: This will overwrite your current database. This process is irreversible. Are you absolutely sure?',
      type: 'danger',
      confirmText: 'Upload & Restore',
      onConfirm: async () => {
        setIsMaintenanceActive(true);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        const formData = new FormData();
        formData.append('file', file);

        try {
          await api.post('/system/restore', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          showNotification("Restore process started. The database will be ready in a few seconds.", "info");
          setTimeout(() => {
            window.location.reload();
          }, 5000);
        } catch (err: any) {
          console.error(err);
        } finally {
          setIsMaintenanceActive(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/users/', formData);
      setIsModalOpen(false);
      setFormData({ name: '', role: 'ENGINEER', software_access: 'BOTH', password: '', timezone: 'UTC' });
      showNotification("User created successfully!", "success");
      fetchUsers();
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload: any = {
        name: editFormData.name,
        role: editFormData.role,
        software_access: editFormData.software_access,
        timezone: editFormData.timezone
      };
      if (editFormData.password) {
        payload.password = editFormData.password;
      }
      
      const res = await api.patch(`/users/${selectedUser.id}`, payload);
      setIsEditModalOpen(false);
      showNotification("User updated successfully!", "success");
      fetchUsers();
      
      // If editing self, update the auth store to reflect immediately (e.g. timezone)
      if (currentUser?.id === selectedUser.id) {
        useAuthStore.getState().login('', res.data);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete User',
      message: `Are you sure you want to delete user "${name}"? This action cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete User',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await api.delete(`/users/${id}`);
          showNotification("User deleted successfully!", "success");
          fetchUsers();
        } catch (err: any) {
          console.error(err);
        }
      }
    });
  };

  const openEditModal = (user: any) => {
    setSelectedUser(user);
    setEditFormData({ 
      name: user.name, 
      role: user.role, 
      software_access: user.software_access || 'BOTH', 
      password: '',
      timezone: user.timezone || 'UTC'
    });
    setIsEditModalOpen(true);
  };

  const handleLogoutAll = async (id: number, name: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Revoke All Sessions',
      message: `Are you sure you want to invalidate all active sessions for ${name}? This will force the user to log in again on all devices.`,
      type: 'warning',
      confirmText: 'Revoke Sessions',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await api.post(`/users/${id}/logout-all`);
          showNotification(`All sessions for ${name} have been revoked.`, "success");
        } catch (err: any) {
          console.error(err);
        }
      }
    });
  };

  return (
    <div>
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
        confirmText={confirmConfig.confirmText}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#111827' }}>User Management</h1>
        {currentUser?.role === 'ADMIN' && (
          <button 
            onClick={() => setIsModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#1a56db', color: 'white', padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 500 }}
          >
            <Plus size={16} /> Add User
          </button>
        )}
      </div>
      
      <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden', marginBottom: '2rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            <tr>
              <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>ID</th>
              <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Name</th>
              <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Role</th>
              <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Software Access</th>
              <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500, textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>#{u.id}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 500, color: '#111827' }}>{u.name} {currentUser?.id === u.id && '(You)'}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                  <span style={{ 
                    padding: '0.125rem 0.625rem', 
                    borderRadius: '9999px', 
                    fontSize: '0.75rem', 
                    fontWeight: 500,
                    backgroundColor: u.role === 'ADMIN' ? '#fde8e8' : (u.role === 'MANAGER' ? '#e1effe' : '#def7ec'),
                    color: u.role === 'ADMIN' ? '#9b1c1c' : (u.role === 'MANAGER' ? '#1e429f' : '#03543f')
                  }}>
                    {u.role}
                  </span>
                </td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                  <span style={{ 
                    padding: '0.125rem 0.625rem', 
                    borderRadius: '4px', 
                    fontSize: '0.7rem', 
                    fontWeight: 600,
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #d1d5db'
                  }}>
                    {u.software_access === 'BOTH' ? 'All Software' : (u.software_access === 'INSTALLATION' ? 'Installation Tracker' : 'Implementation Tracker')}
                  </span>
                </td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    {currentUser?.role === 'ADMIN' && (
                      <>
                        <button 
                          onClick={() => openEditModal(u)}
                          style={{ background: 'none', border: 'none', color: '#1a56db', cursor: 'pointer' }}
                          title="Edit User"
                        >
                          <Edit2 size={16} />
                        </button>
                        {currentUser.id !== u.id && (
                          <button 
                            onClick={() => handleLogoutAll(u.id, u.name)}
                            style={{ background: 'none', border: 'none', color: '#d03801', cursor: 'pointer' }}
                            title="Logout from all devices"
                          >
                            <ShieldAlert size={16} />
                          </button>
                        )}
                        {currentUser.id !== u.id && (
                          <button 
                            onClick={() => handleDelete(u.id, u.name)}
                            style={{ background: 'none', border: 'none', color: '#c81e1e', cursor: 'pointer' }}
                            title="Delete User"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>
                  No users found or unauthorized to view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Database Maintenance Section */}
      {currentUser?.role === 'ADMIN' && (
        <div style={{ marginTop: '3rem', borderTop: '1px solid #e5e7eb', paddingTop: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <Database size={24} style={{ color: '#111827' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827', margin: 0 }}>Database Maintenance</h2>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {/* Backup Card */}
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Full Database Backup</h3>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' }}>
                Download a complete SQL snapshot of the current database. Use this to migrate data or keep offline backups.
              </p>
              <button 
                onClick={handleBackup}
                disabled={isMaintenanceActive}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#111827', color: 'white', padding: '0.625rem 1.25rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}
              >
                <Download size={18} /> {isMaintenanceActive ? 'Processing...' : 'Download Backup (.sql)'}
              </button>
            </div>

            {/* Restore Card */}
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Restore Database</h3>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' }}>
                Upload a valid SQL backup file to overwrite the current database. <span style={{ color: '#c81e1e', fontWeight: 600 }}>WARNING: This is irreversible.</span>
              </p>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleRestore}
                accept=".sql"
                style={{ display: 'none' }}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isMaintenanceActive}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', color: '#c81e1e', padding: '0.625rem 1.25rem', borderRadius: '6px', border: '1px solid #c81e1e', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}
              >
                <Upload size={18} /> {isMaintenanceActive ? 'Processing...' : 'Upload & Restore (.sql)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '8px', width: '100%', maxWidth: '400px', padding: '2rem', position: 'relative' }}>
            <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
              <X size={20} />
            </button>
            <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem' }}>Add New User</h2>
            
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Name / Username *</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Role *</label>
                <select required value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', background: 'white' }}>
                  <option value="ENGINEER">Engineer</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280', background: '#f9fafb', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                  {formData.role === 'ENGINEER' && "Can only view and update tasks specifically assigned to them."}
                  {formData.role === 'MANAGER' && "Can view all data, create tasks, and assign work to Engineers."}
                  {formData.role === 'ADMIN' && "Full access. Can manage users, clients, and all tasks."}
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Software Access *</label>
                <select 
                  required 
                  disabled={formData.role === 'ADMIN' || formData.role === 'ENGINEER'}
                  value={(formData.role === 'ADMIN' || formData.role === 'ENGINEER') ? 'BOTH' : formData.software_access} 
                  onChange={e => setFormData({...formData, software_access: e.target.value})} 
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', background: (formData.role === 'ADMIN' || formData.role === 'ENGINEER') ? '#f3f4f6' : 'white' }}
                >
                  <option value="BOTH">All Software (Both)</option>
                  <option value="INSTALLATION">Installation Tracker Only</option>
                  <option value="IMPLEMENTATION">Implementation Tracker Only</option>
                </select>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Timezone *</label>
                <select required value={formData.timezone} onChange={e => setFormData({...formData, timezone: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', background: 'white' }}>
                  {commonTimezones.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Password *</label>
                <input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '0.5rem 1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '0.5rem 1rem', background: '#1a56db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                  {isSubmitting ? 'Saving...' : 'Save User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && selectedUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '8px', width: '100%', maxWidth: '400px', padding: '2rem', position: 'relative' }}>
            <button onClick={() => setIsEditModalOpen(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
              <X size={20} />
            </button>
            <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem' }}>Edit User: {selectedUser.name}</h2>
            
            <form onSubmit={handleEditSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Name / Username</label>
                <input required type="text" value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Role</label>
                <select required value={editFormData.role} onChange={e => setEditFormData({...editFormData, role: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', background: 'white' }}>
                  <option value="ENGINEER">Engineer</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280', background: '#f9fafb', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                  {editFormData.role === 'ENGINEER' && "Can only view and update tasks specifically assigned to them."}
                  {editFormData.role === 'MANAGER' && "Can view all data, create tasks, and assign work to Engineers."}
                  {editFormData.role === 'ADMIN' && "Full access. Can manage users, clients, and all tasks."}
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Software Access</label>
                <select 
                  required 
                  disabled={editFormData.role === 'ADMIN' || editFormData.role === 'ENGINEER'}
                  value={(editFormData.role === 'ADMIN' || editFormData.role === 'ENGINEER') ? 'BOTH' : editFormData.software_access} 
                  onChange={e => setEditFormData({...editFormData, software_access: e.target.value})} 
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', background: (editFormData.role === 'ADMIN' || editFormData.role === 'ENGINEER') ? '#f3f4f6' : 'white' }}
                >
                  <option value="BOTH">All Software (Both)</option>
                  <option value="INSTALLATION">Installation Tracker Only</option>
                  <option value="IMPLEMENTATION">Implementation Tracker Only</option>
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Timezone</label>
                <select required value={editFormData.timezone} onChange={e => setEditFormData({...editFormData, timezone: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', background: 'white' }}>
                  {commonTimezones.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>New Password (leave blank to keep current)</label>
                <input type="password" value={editFormData.password} onChange={e => setEditFormData({...editFormData, password: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" onClick={() => setIsEditModalOpen(false)} style={{ padding: '0.5rem 1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '0.5rem 1rem', background: '#1a56db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                  {isSubmitting ? 'Updating...' : 'Update User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
