import React, { useEffect, useState } from 'react';
import api from '../api';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { Plus, X, Edit2 } from 'lucide-react';

const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const currentUser = useAuthStore(state => state.user);
  const showNotification = useNotificationStore(state => state.show);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  
  const [formData, setFormData] = useState({ name: '', location_id: '', due_date: '', dependency_task_id: '' });
  const [editData, setEditData] = useState({ status: '', assigned_to: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tasksRes, locRes, usersRes] = await Promise.all([
        api.get('/tasks/?limit=500'),
        api.get('/locations/?limit=500'),
        api.get('/users/?limit=100')
      ]);
      setTasks(tasksRes.data);
      setLocations(locRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/tasks/', {
        name: formData.name,
        location_id: parseInt(formData.location_id),
        due_date: formData.due_date,
        dependency_task_id: formData.dependency_task_id ? parseInt(formData.dependency_task_id) : null
      });
      setIsCreateModalOpen(false);
      setFormData({ name: '', location_id: '', due_date: '', dependency_task_id: '' });
      showNotification("Task created successfully!", "success");
      fetchData();
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (task: any) => {
    setSelectedTask(task);
    setEditData({ 
      status: task.status, 
      assigned_to: task.assigned_to ? task.assigned_to.toString() : '' 
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // If status changed
      if (editData.status !== selectedTask.status) {
        await api.patch(`/tasks/${selectedTask.id}/status`, { status: editData.status });
      }
      // If assignee changed (and user is Manager/Admin)
      if (editData.assigned_to !== (selectedTask.assigned_to?.toString() || '') && currentUser?.role !== 'ENGINEER') {
        await api.patch(`/tasks/${selectedTask.id}/assign`, { 
          assigned_to: editData.assigned_to ? parseInt(editData.assigned_to) : null 
        });
      }
      setIsEditModalOpen(false);
      showNotification("Task updated successfully!", "success");
      fetchData();
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getLocationName = (id: number) => {
    return locations.find(l => l.id === id)?.name || id;
  };

  const getUserName = (id: number) => {
    return users.find(u => u.id === id)?.name || id;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#111827' }}>Task Board</h1>
        {currentUser?.role !== 'ENGINEER' && (
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#1a56db', color: 'white', padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 500 }}
          >
            <Plus size={16} /> Create Task
          </button>
        )}
      </div>
      
      <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            <tr>
              <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>ID</th>
              <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Task Name</th>
              <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Location</th>
              <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Assignee</th>
              <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Due Date</th>
              <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Status</th>
              <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>#{t.id}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 500, color: '#111827' }}>
                  {t.name}
                  {t.dependency_task_id && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>Depends on #{t.dependency_task_id}</div>}
                </td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#374151' }}>{getLocationName(t.location_id)}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  {t.assigned_to ? getUserName(t.assigned_to) : <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Unassigned</span>}
                </td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{t.due_date}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                  <span style={{ 
                    padding: '0.125rem 0.625rem', 
                    borderRadius: '9999px', 
                    fontSize: '0.75rem', 
                    fontWeight: 500,
                    backgroundColor: t.status === 'COMPLETED' ? '#def7ec' : (t.status === 'IN_PROGRESS' ? '#e1effe' : (t.status === 'BLOCKED' ? '#fdf2f2' : '#f3f4f6')),
                    color: t.status === 'COMPLETED' ? '#03543f' : (t.status === 'IN_PROGRESS' ? '#1e429f' : (t.status === 'BLOCKED' ? '#9b1c1c' : '#374151'))
                  }}>
                    {t.status.replace('_', ' ')}
                  </span>
                </td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                  <button 
                    onClick={() => openEditModal(t)}
                    style={{ background: 'none', border: 'none', color: '#1a56db', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <Edit2 size={16} /> Edit
                  </button>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>No tasks found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '8px', width: '100%', maxWidth: '500px', padding: '2rem', position: 'relative' }}>
            <button onClick={() => setIsCreateModalOpen(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
              <X size={20} />
            </button>
            <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem' }}>Create New Task</h2>
            
            <form onSubmit={handleCreateSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Task Name *</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Location *</label>
                <select required value={formData.location_id} onChange={e => setFormData({...formData, location_id: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', background: 'white' }}>
                  <option value="" disabled>Select location</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Due Date *</label>
                <input required type="date" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Dependency (Optional Task ID)</label>
                <input type="number" value={formData.dependency_task_id} onChange={e => setFormData({...formData, dependency_task_id: e.target.value})} placeholder="e.g. 5" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" onClick={() => setIsCreateModalOpen(false)} style={{ padding: '0.5rem 1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '0.5rem 1rem', background: '#1a56db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                  {isSubmitting ? 'Saving...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && selectedTask && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '8px', width: '100%', maxWidth: '500px', padding: '2rem', position: 'relative' }}>
            <button onClick={() => setIsEditModalOpen(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
              <X size={20} />
            </button>
            <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem' }}>Update Task: {selectedTask.name}</h2>
            
            <form onSubmit={handleEditSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Status *</label>
                <select required value={editData.status} onChange={e => setEditData({...editData, status: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', background: 'white' }}>
                  <option value="NOT_STARTED">Not Started</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="BLOCKED">Blocked</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>

              {currentUser?.role !== 'ENGINEER' && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Assignee</label>
                  <select value={editData.assigned_to} onChange={e => setEditData({...editData, assigned_to: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', background: 'white' }}>
                    <option value="">-- Unassigned --</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" onClick={() => setIsEditModalOpen(false)} style={{ padding: '0.5rem 1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '0.5rem 1rem', background: '#1a56db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                  {isSubmitting ? 'Saving...' : 'Update Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;