import React, { useEffect, useState, useCallback } from 'react';
import api from '../api';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { Plus, Edit2 } from 'lucide-react';
import Modal from '../components/Modal';
import { TableSkeleton } from '../components/Skeleton';
import type { Task, Location, User, TaskStatus, TaskCreate } from '../types/api';

const STATUS_BADGE: Record<TaskStatus, string> = {
  COMPLETED:   'badge-green',
  IN_PROGRESS: 'badge-blue',
  BLOCKED:     'badge-red',
  NOT_STARTED: 'badge-gray',
};

const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState<TaskCreate>({ name: '', location_id: 0, due_date: '' });
  const [editData, setEditData] = useState({ status: '' as TaskStatus, assigned_to: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentUser = useAuthStore((s) => s.user);
  const showNotification = useNotificationStore((s) => s.show);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tasksRes, locRes, usersRes] = await Promise.all([
        api.get<Task[]>('/tasks/?limit=500'),
        api.get<Location[]>('/locations/?limit=500'),
        api.get<User[]>('/users/?limit=100'),
      ]);
      setTasks(tasksRes.data);
      setLocations(locRes.data);
      setUsers(usersRes.data);
    } catch { /* handled */ } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/tasks/', formData);
      setIsCreateModalOpen(false);
      setFormData({ name: '', location_id: 0, due_date: '' });
      showNotification('Task created!', 'success');
      fetchData();
    } catch { /* handled */ } finally { setIsSubmitting(false); }
  };

  const openEditModal = (task: Task) => {
    setSelectedTask(task);
    setEditData({ status: task.status, assigned_to: task.assigned_to?.toString() ?? '' });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    setIsSubmitting(true);
    try {
      if (editData.status !== selectedTask.status) {
        await api.patch(`/tasks/${selectedTask.id}/status`, { status: editData.status });
      }
      if (editData.assigned_to !== (selectedTask.assigned_to?.toString() ?? '') && currentUser?.role !== 'ENGINEER') {
        await api.patch(`/tasks/${selectedTask.id}/assign`, {
          assigned_to: editData.assigned_to ? parseInt(editData.assigned_to) : null,
        });
      }
      setIsEditModalOpen(false);
      showNotification('Task updated!', 'success');
      fetchData();
    } catch { /* handled */ } finally { setIsSubmitting(false); }
  };

  const getLocationName = (id: number) => locations.find((l) => l.id === id)?.name ?? `#${id}`;
  const getUserName = (id: number) => users.find((u) => u.id === id)?.name ?? `#${id}`;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Task Board</h1>
        {currentUser?.role !== 'ENGINEER' && (
          <button onClick={() => setIsCreateModalOpen(true)} className="btn-primary">
            <Plus size={16} /> Create Task
          </button>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Task Name</th>
                <th scope="col">Location</th>
                <th scope="col">Assignee</th>
                <th scope="col">Due Date</th>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td className="text-gray-400 font-mono text-xs">#{t.id}</td>
                  <td>
                    <p className="font-semibold text-gray-900">{t.name}</p>
                    {t.dependency_task_id && (
                      <p className="text-xs text-gray-400 mt-0.5">Depends on #{t.dependency_task_id}</p>
                    )}
                  </td>
                  <td>{getLocationName(t.location_id)}</td>
                  <td>
                    {t.assigned_to
                      ? getUserName(t.assigned_to)
                      : <span className="text-gray-400 italic text-xs">Unassigned</span>}
                  </td>
                  <td className="text-gray-500">{t.due_date}</td>
                  <td>
                    <span className={STATUS_BADGE[t.status]}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => openEditModal(t)} className="btn-ghost text-blue-600 hover:bg-blue-50" aria-label={`Edit task ${t.name}`}>
                      <Edit2 size={14} /> Edit
                    </button>
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr><td colSpan={7} className="text-center text-gray-400 py-8">No tasks found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create New Task"
        footer={
          <>
            <button onClick={() => setIsCreateModalOpen(false)} className="btn-secondary">Cancel</button>
            <button form="create-task-form" type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Saving…' : 'Create Task'}
            </button>
          </>
        }
      >
        <form id="create-task-form" onSubmit={handleCreateSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="task-name" className="label">Task Name <span className="text-red-500">*</span></label>
            <input id="task-name" required type="text" value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input" />
          </div>
          <div className="form-group">
            <label htmlFor="task-location" className="label">Location <span className="text-red-500">*</span></label>
            <select id="task-location" required value={formData.location_id || ''}
              onChange={(e) => setFormData({ ...formData, location_id: parseInt(e.target.value) })}
              className="input">
              <option value="" disabled>Select location</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="task-due" className="label">Due Date <span className="text-red-500">*</span></label>
            <input id="task-due" required type="date" value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} className="input" />
          </div>
          <div className="form-group">
            <label htmlFor="task-dep" className="label">Dependency Task ID (optional)</label>
            <input id="task-dep" type="number" value={formData.dependency_task_id ?? ''}
              onChange={(e) => setFormData({ ...formData, dependency_task_id: e.target.value ? parseInt(e.target.value) : null })}
              placeholder="e.g. 5" className="input" />
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)}
        title={`Update Task: ${selectedTask?.name ?? ''}`}
        footer={
          <>
            <button onClick={() => setIsEditModalOpen(false)} className="btn-secondary">Cancel</button>
            <button form="edit-task-form" type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Saving…' : 'Update Task'}
            </button>
          </>
        }
      >
        <form id="edit-task-form" onSubmit={handleEditSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="edit-status" className="label">Status <span className="text-red-500">*</span></label>
            <select id="edit-status" required value={editData.status}
              onChange={(e) => setEditData({ ...editData, status: e.target.value as TaskStatus })}
              className="input">
              <option value="NOT_STARTED">Not Started</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="BLOCKED">Blocked</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
          {currentUser?.role !== 'ENGINEER' && (
            <div className="form-group">
              <label htmlFor="edit-assignee" className="label">Assignee</label>
              <select id="edit-assignee" value={editData.assigned_to}
                onChange={(e) => setEditData({ ...editData, assigned_to: e.target.value })}
                className="input">
                <option value="">— Unassigned —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
};

export default Tasks;
