import React, { useEffect, useState, useRef, useCallback } from 'react';
import api from '../api';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { Plus, Trash2, Database, Upload, Download, Edit2, ShieldAlert } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';
import { TableSkeleton } from '../components/Skeleton';
import type { User, UserCreate, UserRole, SoftwareAccess } from '../types/api';

const TIMEZONES = [
  { value: 'UTC',            label: 'UTC (GMT)' },
  { value: 'Asia/Kolkata',   label: 'IST (India — GMT+5:30)' },
  { value: 'America/New_York', label: 'EST (New York — GMT-5)' },
  { value: 'Europe/London',  label: 'GMT/BST (London)' },
  { value: 'Asia/Dubai',     label: 'GST (Dubai — GMT+4)' },
  { value: 'Singapore',      label: 'SGT (Singapore — GMT+8)' },
];

const ROLE_HINT: Record<UserRole, string> = {
  ENGINEER: 'Can only view and update tasks assigned to them.',
  MANAGER:  'Can view all data, create tasks, and assign work.',
  ADMIN:    'Full access. Can manage users, clients, and all tasks.',
};

const EMPTY_FORM = { name: '', role: 'ENGINEER' as UserRole, software_access: 'BOTH' as SoftwareAccess, password: '', timezone: 'UTC' };

interface ConfirmConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  type: 'danger' | 'warning' | 'info';
  confirmText: string;
}

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editFormData, setEditFormData] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig>({
    isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning', confirmText: 'Confirm',
  });

  const currentUser = useAuthStore((s) => s.user);
  const showNotification = useNotificationStore((s) => s.show);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<User[]>('/users/');
      setUsers(res.data);
    } catch { /* handled */ } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload: UserCreate = {
        ...formData,
        software_access: (formData.role === 'ADMIN' || formData.role === 'ENGINEER') ? 'BOTH' : formData.software_access,
      };
      await api.post('/users/', payload);
      showNotification('User created!', 'success');
      setIsAddModalOpen(false);
      setFormData(EMPTY_FORM);
      fetchUsers();
    } catch { /* handled */ } finally { setIsSubmitting(false); }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: editFormData.name,
        role: editFormData.role,
        software_access: (editFormData.role === 'ADMIN' || editFormData.role === 'ENGINEER') ? 'BOTH' : editFormData.software_access,
        timezone: editFormData.timezone,
      };
      if (editFormData.password) payload.password = editFormData.password;
      const res = await api.patch<User>(`/users/${selectedUser.id}`, payload);
      showNotification('User updated!', 'success');
      setIsEditModalOpen(false);
      fetchUsers();
      if (currentUser?.id === selectedUser.id) {
        useAuthStore.getState().login(res.data);
      }
    } catch { /* handled */ } finally { setIsSubmitting(false); }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditFormData({ name: user.name, role: user.role, software_access: user.software_access, password: '', timezone: user.timezone });
    setIsEditModalOpen(true);
  };

  const handleDelete = (id: number, name: string) => {
    setConfirmConfig({
      isOpen: true, title: 'Delete User', type: 'danger', confirmText: 'Delete User',
      message: `Delete user "${name}"? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmConfig((p) => ({ ...p, isOpen: false }));
        try {
          await api.delete(`/users/${id}`);
          showNotification('User deleted.', 'success');
          fetchUsers();
        } catch { /* handled */ }
      },
    });
  };

  const handleLogoutAll = (id: number, name: string) => {
    setConfirmConfig({
      isOpen: true, title: 'Revoke All Sessions', type: 'warning', confirmText: 'Revoke Sessions',
      message: `Invalidate all active sessions for ${name}? They will need to log in again.`,
      onConfirm: async () => {
        setConfirmConfig((p) => ({ ...p, isOpen: false }));
        try {
          await api.post(`/users/${id}/logout-all`);
          showNotification(`Sessions revoked for ${name}.`, 'success');
        } catch { /* handled */ }
      },
    });
  };

  const handleBackup = async () => {
    setIsMaintenance(true);
    try {
      const res = await api.get('/system/backup', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data as BlobPart]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `cdms_backup_${new Date().toISOString().split('T')[0]}.sql`;
      a.click();
      URL.revokeObjectURL(url);
      showNotification('Backup downloaded!', 'success');
    } catch { /* handled */ } finally { setIsMaintenance(false); }
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setConfirmConfig({
      isOpen: true, title: 'Restore Database', type: 'danger', confirmText: 'Upload & Restore',
      message: 'WARNING: This will overwrite your current database. This is irreversible. Are you sure?',
      onConfirm: async () => {
        setIsMaintenance(true);
        setConfirmConfig((p) => ({ ...p, isOpen: false }));
        const fd = new FormData();
        fd.append('file', file);
        try {
          await api.post('/system/restore', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
          showNotification('Restore started. Ready in a few seconds.', 'info');
          setTimeout(() => window.location.reload(), 5000);
        } catch { /* handled */ } finally {
          setIsMaintenance(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
    });
  };

  const roleBadge = (role: UserRole) => {
    const map: Record<UserRole, string> = { ADMIN: 'badge-red', MANAGER: 'badge-blue', ENGINEER: 'badge-green' };
    return map[role];
  };

  const UserForm = ({ data, setData, isEdit = false }: {
    data: typeof EMPTY_FORM;
    setData: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
    isEdit?: boolean;
  }) => (
    <div className="space-y-4">
      <div className="form-group">
        <label htmlFor={`${isEdit ? 'edit' : 'add'}-name`} className="label">Username <span className="text-red-500">*</span></label>
        <input id={`${isEdit ? 'edit' : 'add'}-name`} required type="text" value={data.name}
          onChange={(e) => setData({ ...data, name: e.target.value })} className="input" />
      </div>
      <div className="form-group">
        <label htmlFor={`${isEdit ? 'edit' : 'add'}-role`} className="label">Role <span className="text-red-500">*</span></label>
        <select id={`${isEdit ? 'edit' : 'add'}-role`} required value={data.role}
          onChange={(e) => setData({ ...data, role: e.target.value as UserRole })} className="input">
          <option value="ENGINEER">Engineer</option>
          <option value="MANAGER">Manager</option>
          <option value="ADMIN">Admin</option>
        </select>
        <p className="text-xs text-gray-500 mt-1 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
          {ROLE_HINT[data.role]}
        </p>
      </div>
      <div className="form-group">
        <label htmlFor={`${isEdit ? 'edit' : 'add'}-access`} className="label">Software Access</label>
        <select id={`${isEdit ? 'edit' : 'add'}-access`}
          disabled={data.role === 'ADMIN' || data.role === 'ENGINEER'}
          value={(data.role === 'ADMIN' || data.role === 'ENGINEER') ? 'BOTH' : data.software_access}
          onChange={(e) => setData({ ...data, software_access: e.target.value as SoftwareAccess })}
          className="input disabled:bg-gray-100">
          <option value="BOTH">All Software (Both)</option>
          <option value="INSTALLATION">Installation Tracker Only</option>
          <option value="IMPLEMENTATION">Implementation Tracker Only</option>
        </select>
      </div>
      <div className="form-group">
        <label htmlFor={`${isEdit ? 'edit' : 'add'}-tz`} className="label">Timezone</label>
        <select id={`${isEdit ? 'edit' : 'add'}-tz`} value={data.timezone}
          onChange={(e) => setData({ ...data, timezone: e.target.value })} className="input">
          {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor={`${isEdit ? 'edit' : 'add'}-pw`} className="label">
          {isEdit ? 'New Password (leave blank to keep current)' : <>Password <span className="text-red-500">*</span></>}
        </label>
        <input id={`${isEdit ? 'edit' : 'add'}-pw`} type="password" required={!isEdit}
          value={data.password} onChange={(e) => setData({ ...data, password: e.target.value })}
          className="input" autoComplete={isEdit ? 'new-password' : 'new-password'} />
      </div>
    </div>
  );

  return (
    <div>
      <ConfirmModal {...confirmConfig} onClose={() => setConfirmConfig((p) => ({ ...p, isOpen: false }))} />

      <div className="page-header">
        <h1 className="page-title">User Management</h1>
        {currentUser?.role === 'ADMIN' && (
          <button onClick={() => setIsAddModalOpen(true)} className="btn-primary">
            <Plus size={16} /> Add User
          </button>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : (
        <div className="table-wrapper mb-8">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Name</th>
                <th scope="col">Role</th>
                <th scope="col">Software Access</th>
                <th scope="col" className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="text-gray-400 font-mono text-xs">#{u.id}</td>
                  <td className="font-semibold text-gray-900">
                    {u.name} {currentUser?.id === u.id && <span className="text-xs text-gray-400 font-normal">(You)</span>}
                  </td>
                  <td><span className={roleBadge(u.role)}>{u.role}</span></td>
                  <td>
                    <span className="badge badge-gray text-xs">
                      {u.software_access === 'BOTH' ? 'All Software' : u.software_access === 'INSTALLATION' ? 'Installation' : 'Implementation'}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      {currentUser?.role === 'ADMIN' && (
                        <>
                          <button onClick={() => openEditModal(u)} className="btn-ghost" aria-label={`Edit ${u.name}`} title="Edit user">
                            <Edit2 size={15} />
                          </button>
                          {currentUser.id !== u.id && (
                            <button onClick={() => handleLogoutAll(u.id, u.name)} className="btn-ghost text-orange-600 hover:bg-orange-50" aria-label={`Revoke sessions for ${u.name}`} title="Revoke all sessions">
                              <ShieldAlert size={15} />
                            </button>
                          )}
                          {currentUser.id !== u.id && (
                            <button onClick={() => handleDelete(u.id, u.name)} className="btn-ghost text-red-600 hover:bg-red-50" aria-label={`Delete ${u.name}`} title="Delete user">
                              <Trash2 size={15} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} className="text-center text-gray-400 py-8">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Database Maintenance */}
      {currentUser?.role === 'ADMIN' && (
        <section aria-labelledby="db-heading" className="border-t border-gray-200 pt-8">
          <div className="flex items-center gap-3 mb-5">
            <Database size={22} className="text-gray-700" aria-hidden="true" />
            <h2 id="db-heading" className="text-xl font-bold text-gray-900">Database Maintenance</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="font-semibold mb-1">Full Database Backup</h3>
              <p className="text-sm text-gray-500 mb-4">Download a complete SQL snapshot. Use for migrations or offline backups.</p>
              <button onClick={handleBackup} disabled={isMaintenance} className="btn-dark">
                <Download size={16} /> {isMaintenance ? 'Processing…' : 'Download Backup (.sql)'}
              </button>
            </div>
            <div className="card p-5">
              <h3 className="font-semibold mb-1">Restore Database</h3>
              <p className="text-sm text-gray-500 mb-4">
                Upload a SQL backup to overwrite the current database.{' '}
                <span className="text-red-600 font-semibold">This is irreversible.</span>
              </p>
              <input ref={fileInputRef} type="file" accept=".sql" onChange={handleRestore} className="hidden" aria-label="Upload SQL backup file" />
              <button onClick={() => fileInputRef.current?.click()} disabled={isMaintenance}
                className="btn bg-white text-red-600 border border-red-300 hover:bg-red-50 focus:ring-red-400">
                <Upload size={16} /> {isMaintenance ? 'Processing…' : 'Upload & Restore (.sql)'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Add Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add New User"
        footer={
          <>
            <button onClick={() => setIsAddModalOpen(false)} className="btn-secondary">Cancel</button>
            <button form="add-user-form" type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Saving…' : 'Save User'}
            </button>
          </>
        }
      >
        <form id="add-user-form" onSubmit={handleAddSubmit} noValidate>
          <UserForm data={formData} setData={setFormData} />
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)}
        title={`Edit User: ${selectedUser?.name ?? ''}`}
        footer={
          <>
            <button onClick={() => setIsEditModalOpen(false)} className="btn-secondary">Cancel</button>
            <button form="edit-user-form" type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Updating…' : 'Update User'}
            </button>
          </>
        }
      >
        <form id="edit-user-form" onSubmit={handleEditSubmit} noValidate>
          <UserForm data={editFormData} setData={setEditFormData} isEdit />
        </form>
      </Modal>
    </div>
  );
};

export default Users;
