import React, { useEffect, useState } from 'react';
import api from '../api';
import { useAuthStore } from '../store/authStore';
import { Plus, X, ChevronDown, ChevronRight, Edit2 } from 'lucide-react';

const Clients: React.FC = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  const currentUser = useAuthStore(state => state.user);
  
  const [expandedClient, setExpandedClient] = useState<number | null>(null);
  
  // Modals state
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isEditTaskModalOpen, setIsEditTaskModalOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  const [clientFormData, setClientFormData] = useState({ name: '', database_type: 'MS SQL', database_version: '', remarks: '' });
  const [editTaskFormData, setEditTaskFormData] = useState({ status: '', assigned_to: '', build_version: '', remarks: '' });
  const [createTaskFormData, setCreateTaskFormData] = useState({ name: '', due_date: '', build_version: '', remarks: '', assigned_to: '', client_id: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [clientRes, locRes, taskRes, userRes] = await Promise.all([
        api.get('/clients/?limit=500'),
        api.get('/locations/?limit=500'),
        api.get('/tasks/?limit=500'),
        api.get('/users/?limit=100')
      ]);
      setClients(clientRes.data);
      setLocations(locRes.data);
      setTasks(taskRes.data);
      setUsers(userRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/clients/', clientFormData);
      setIsClientModalOpen(false);
      setClientFormData({ name: '', database_type: 'MS SQL', database_version: '', remarks: '' });
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to create client');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCreateTask = (clientId: number) => {
    setCreateTaskFormData({ name: '', due_date: '', build_version: '', remarks: '', assigned_to: '', client_id: clientId });
    setIsCreateTaskModalOpen(true);
  };

  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // 1. Find or create location for this client
      let locationId;
      const clientLocation = locations.find(l => l.client_id === createTaskFormData.client_id);
      if (clientLocation) {
        locationId = clientLocation.id;
      } else {
        const newLoc = await api.post('/locations/', { name: 'Main Office', client_id: createTaskFormData.client_id, hostname: '' });
        locationId = newLoc.data.id;
      }

      // 2. Create the task
      const newTask = await api.post('/tasks/', {
        name: createTaskFormData.name,
        due_date: createTaskFormData.due_date,
        build_version: createTaskFormData.build_version || null,
        remarks: createTaskFormData.remarks || null,
        location_id: locationId
      });

      // 3. Assign user if selected
      if (createTaskFormData.assigned_to) {
        await api.patch(`/tasks/${newTask.data.id}/assign`, { assigned_to: parseInt(createTaskFormData.assigned_to) });
      }

      setIsCreateTaskModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openTaskEdit = (task: any) => {
    setSelectedTask(task);
    setEditTaskFormData({ 
      status: task.status, 
      assigned_to: task.assigned_to ? task.assigned_to.toString() : '',
      build_version: task.build_version || '',
      remarks: task.remarks || ''
    });
    setIsEditTaskModalOpen(true);
  };

  const handleEditTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Update general fields
      if (editTaskFormData.build_version !== (selectedTask.build_version || '') || editTaskFormData.remarks !== (selectedTask.remarks || '')) {
        await api.patch(`/tasks/${selectedTask.id}`, { 
          build_version: editTaskFormData.build_version,
          remarks: editTaskFormData.remarks
        });
      }
      // Update status
      if (editTaskFormData.status !== selectedTask.status) {
        await api.patch(`/tasks/${selectedTask.id}/status`, { status: editTaskFormData.status });
      }
      // Update Assignee
      if (editTaskFormData.assigned_to !== (selectedTask.assigned_to?.toString() || '') && currentUser?.role !== 'Engineer') {
        await api.patch(`/tasks/${selectedTask.id}/assign`, { 
          assigned_to: editTaskFormData.assigned_to ? parseInt(editTaskFormData.assigned_to) : null 
        });
      }
      setIsEditTaskModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUserName = (id: number) => {
    return users.find(u => u.id === id)?.name || id;
  };

  const getClientTasks = (clientId: number) => {
    const clientLocs = locations.filter(l => l.client_id === clientId).map(l => l.id);
    return tasks.filter(t => clientLocs.includes(t.location_id));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#111827' }}>Clients & Tracking Overview</h1>
        {currentUser?.role !== 'Engineer' && (
          <button 
            onClick={() => setIsClientModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#1a56db', color: 'white', padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 500 }}
          >
            <Plus size={16} /> Add Client
          </button>
        )}
      </div>
      
      <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Client Name</th>
              <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Database</th>
              <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Remarks</th>
              <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Tasks Status</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const clientTasks = getClientTasks(c.id);
              const isExpanded = expandedClient === c.id;
              const completedTasks = clientTasks.filter(t => t.status === 'COMPLETED').length;
              
              return (
                <React.Fragment key={c.id}>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', background: isExpanded ? '#f9fafb' : 'white' }}>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                      <button 
                        onClick={() => setExpandedClient(isExpanded ? null : c.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
                      >
                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </button>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 500, color: '#111827' }}>
                      {c.name}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#374151' }}>
                      {c.database_type ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span style={{ background: '#e5e7eb', padding: '0.125rem 0.5rem', borderRadius: '4px', width: 'fit-content' }}>{c.database_type}</span>
                          {c.database_version && <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>v{c.database_version}</span>}
                        </div>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#6b7280', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.remarks}>
                      {c.remarks || '-'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      {clientTasks.length > 0 ? (
                        <span style={{ color: completedTasks === clientTasks.length ? '#046c4e' : '#b45309', fontWeight: 500 }}>
                          {completedTasks} / {clientTasks.length} Completed
                        </span>
                      ) : 'No Tasks'}
                    </td>
                  </tr>
                  
                  {isExpanded && (
                    <tr style={{ background: '#fcfcfd', borderBottom: '1px solid #e5e7eb' }}>
                      <td colSpan={5} style={{ padding: '1.5rem 2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <h3 style={{ margin: 0, fontSize: '1rem', color: '#111827', fontWeight: 600 }}>Tracking Phases</h3>
                          {currentUser?.role !== 'Engineer' && (
                            <button 
                              onClick={() => openCreateTask(c.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'white', color: '#1a56db', border: '1px solid #1a56db', padding: '0.375rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
                            >
                              <Plus size={14} /> Add Task
                            </button>
                          )}
                        </div>

                        {clientTasks.length > 0 ? (
                          <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: 'white' }}>
                              <thead style={{ background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
                                <tr>
                                  <th style={{ padding: '0.5rem 1rem', color: '#4b5563', fontSize: '0.75rem', fontWeight: 600 }}>Tracking Phase</th>
                                  <th style={{ padding: '0.5rem 1rem', color: '#4b5563', fontSize: '0.75rem', fontWeight: 600 }}>Build Version</th>
                                  <th style={{ padding: '0.5rem 1rem', color: '#4b5563', fontSize: '0.75rem', fontWeight: 600 }}>Remarks</th>
                                  <th style={{ padding: '0.5rem 1rem', color: '#4b5563', fontSize: '0.75rem', fontWeight: 600 }}>Due Date</th>
                                  <th style={{ padding: '0.5rem 1rem', color: '#4b5563', fontSize: '0.75rem', fontWeight: 600 }}>Point of Contact</th>
                                  <th style={{ padding: '0.5rem 1rem', color: '#4b5563', fontSize: '0.75rem', fontWeight: 600 }}>Status</th>
                                  <th style={{ padding: '0.5rem 1rem', color: '#4b5563', fontSize: '0.75rem', fontWeight: 600 }}>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {clientTasks.map(t => (
                                  <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, color: '#111827' }}>{t.name}</td>
                                    <td style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', color: '#374151' }}>
                                      {t.build_version ? <span style={{ fontFamily: 'monospace', background: '#f3f4f6', padding: '0.125rem 0.25rem', borderRadius: '4px' }}>{t.build_version}</span> : '-'}
                                    </td>
                                    <td style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', color: '#6b7280', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={t.remarks}>
                                      {t.remarks || '-'}
                                    </td>
                                    <td style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{t.due_date}</td>
                                    <td style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                                      {t.assigned_to ? getUserName(t.assigned_to) : <span style={{ fontStyle: 'italic' }}>Unassigned</span>}
                                    </td>
                                    <td style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                                      <span style={{ 
                                        padding: '0.125rem 0.5rem', 
                                        borderRadius: '4px', 
                                        fontSize: '0.75rem', 
                                        fontWeight: 600,
                                        backgroundColor: t.status === 'COMPLETED' ? '#def7ec' : (t.status === 'IN_PROGRESS' ? '#e1effe' : (t.status === 'BLOCKED' ? '#fdf2f2' : '#f3f4f6')),
                                        color: t.status === 'COMPLETED' ? '#03543f' : (t.status === 'IN_PROGRESS' ? '#1e429f' : (t.status === 'BLOCKED' ? '#9b1c1c' : '#374151'))
                                      }}>
                                        {t.status.replace('_', ' ')}
                                      </span>
                                    </td>
                                    <td style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                                      <button 
                                        onClick={() => openTaskEdit(t)}
                                        style={{ background: 'none', border: 'none', color: '#1a56db', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                      >
                                        <Edit2 size={14} /> Edit
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.875rem', padding: '1rem' }}>
                            No tracking tasks have been added for this client yet.
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {clients.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>No clients found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Client Create Modal */}
      {isClientModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '8px', width: '100%', maxWidth: '500px', padding: '2rem', position: 'relative' }}>
            <button onClick={() => setIsClientModalOpen(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
              <X size={20} />
            </button>
            <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem' }}>Add New Client</h2>
            
            <form onSubmit={handleClientSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Client Name *</label>
                <input required type="text" value={clientFormData.name} onChange={e => setClientFormData({...clientFormData, name: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Database Type</label>
                  <select value={clientFormData.database_type} onChange={e => setClientFormData({...clientFormData, database_type: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', background: 'white' }}>
                    <option value="">-- None --</option>
                    <option value="MS SQL">MS SQL</option>
                    <option value="MySQL">MySQL</option>
                    <option value="Oracle">Oracle</option>
                    <option value="PostgreSQL">PostgreSQL</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>DB Version</label>
                  <input type="text" value={clientFormData.database_version} onChange={e => setClientFormData({...clientFormData, database_version: e.target.value})} placeholder="e.g. 2019, 15.0" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Remarks</label>
                <textarea rows={3} value={clientFormData.remarks} onChange={e => setClientFormData({...clientFormData, remarks: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}></textarea>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" onClick={() => setIsClientModalOpen(false)} style={{ padding: '0.5rem 1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '0.5rem 1rem', background: '#1a56db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                  {isSubmitting ? 'Saving...' : 'Save Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Create Modal */}
      {isCreateTaskModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '8px', width: '100%', maxWidth: '500px', padding: '2rem', position: 'relative' }}>
            <button onClick={() => setIsCreateTaskModalOpen(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
              <X size={20} />
            </button>
            <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem' }}>Add Tracking Phase</h2>
            
            <form onSubmit={handleCreateTaskSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Phase Name *</label>
                <input required type="text" value={createTaskFormData.name} onChange={e => setCreateTaskFormData({...createTaskFormData, name: e.target.value})} placeholder="e.g. UAT Installation" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Due Date *</label>
                  <input required type="date" value={createTaskFormData.due_date} onChange={e => setCreateTaskFormData({...createTaskFormData, due_date: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Build Version</label>
                  <input type="text" value={createTaskFormData.build_version} onChange={e => setCreateTaskFormData({...createTaskFormData, build_version: e.target.value})} placeholder="e.g. CV2025_V1.2.0" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Point of Contact</label>
                <select value={createTaskFormData.assigned_to} onChange={e => setCreateTaskFormData({...createTaskFormData, assigned_to: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', background: 'white' }}>
                  <option value="">-- Unassigned --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Remarks</label>
                <textarea rows={3} value={createTaskFormData.remarks} onChange={e => setCreateTaskFormData({...createTaskFormData, remarks: e.target.value})} placeholder="Add comments here..." style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}></textarea>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" onClick={() => setIsCreateTaskModalOpen(false)} style={{ padding: '0.5rem 1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '0.5rem 1rem', background: '#1a56db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                  {isSubmitting ? 'Saving...' : 'Add Phase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Edit Modal */}
      {isEditTaskModalOpen && selectedTask && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '8px', width: '100%', maxWidth: '400px', padding: '2rem', position: 'relative' }}>
            <button onClick={() => setIsEditTaskModalOpen(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
              <X size={20} />
            </button>
            <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem' }}>Update Tracking: {selectedTask.name}</h2>
            
            <form onSubmit={handleEditTaskSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Status *</label>
                  <select required value={editTaskFormData.status} onChange={e => setEditTaskFormData({...editTaskFormData, status: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', background: 'white' }}>
                    <option value="NOT_STARTED">Not Started / Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="BLOCKED">Blocked</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Build Version</label>
                  <input type="text" value={editTaskFormData.build_version} onChange={e => setEditTaskFormData({...editTaskFormData, build_version: e.target.value})} placeholder="e.g. CV2025_V1.2.0" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
                </div>
              </div>

              {currentUser?.role !== 'Engineer' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Point of Contact</label>
                  <select value={editTaskFormData.assigned_to} onChange={e => setEditTaskFormData({...editTaskFormData, assigned_to: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', background: 'white' }}>
                    <option value="">-- Unassigned --</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Remarks</label>
                <textarea rows={3} value={editTaskFormData.remarks} onChange={e => setEditTaskFormData({...editTaskFormData, remarks: e.target.value})} placeholder="Add comments here..." style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}></textarea>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" onClick={() => setIsEditTaskModalOpen(false)} style={{ padding: '0.5rem 1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '0.5rem 1rem', background: '#1a56db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                  {isSubmitting ? 'Saving...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Clients;