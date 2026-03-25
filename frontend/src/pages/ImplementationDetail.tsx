import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useNotificationStore } from '../store/notificationStore';
import { 
  ArrowLeft, 
  Settings, 
  Plus, 
  CheckCircle2, 
  Circle,
  TrendingUp,
  Target,
  User
} from 'lucide-react';

const ImplementationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const [logFormData, setLogFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    remarks: ''
  });

  const [editFormData, setEditFormData] = useState({
    poc_name: '',
    version_details: '',
    po_date: '',
    start_date: '',
    expected_end_date: '',
    status: ''
  });

  const showNotification = useNotificationStore(state => state.show);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProject();
  }, [id]);

  const fetchProject = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/implementations/${id}`);
      setProject(res.data);
      setEditFormData({
        poc_name: res.data.poc_name || '',
        version_details: res.data.version_details || '',
        po_date: res.data.po_date || '',
        start_date: res.data.start_date || '',
        expected_end_date: res.data.expected_end_date || '',
        status: res.data.status || 'InProgress'
      });
    } catch (err) {
      console.error(err);
      showNotification("Failed to load project details", "error");
      navigate('/implementations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTask = async (taskId: number, currentStatus: boolean) => {
    try {
      await api.patch(`/implementations/tasks/${taskId}`, { is_completed: !currentStatus });
      fetchProject(); // Refresh to get new percentage
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/implementations/${id}/logs`, logFormData);
      showNotification("Daily log added!", "success");
      setIsLogModalOpen(false);
      setLogFormData({ date: new Date().toISOString().split('T')[0], remarks: '' });
      fetchProject();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.patch(`/implementations/${id}`, editFormData);
      showNotification("Project updated successfully!", "success");
      setIsEditModalOpen(false);
      fetchProject();
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) return <div className="p-10 text-center">Loading project details...</div>;
  if (!project) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button 
          onClick={() => navigate('/implementations')}
          style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827', margin: 0 }}>{project.company_name}</h1>
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <User size={16} /> {project.poc_name || 'No POC'}
            </span>
            <span style={{ fontSize: '0.875rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <TrendingUp size={16} /> {project.version_details || 'No Version'}
            </span>
            <span style={{ fontSize: '0.875rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Target size={16} /> Status: <strong style={{ color: '#111827' }}>{project.status}</strong>
            </span>
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button 
            onClick={() => setIsEditModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', border: '1px solid #d1d5db', padding: '0.625rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
          >
            <Settings size={18} /> Edit Project
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div style={{ background: '#111827', borderRadius: '12px', padding: '1.5rem', color: 'white', display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '2rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: 600 }}>Overall Progress</span>
            <span style={{ fontWeight: 700, fontSize: '1.25rem' }}>{Math.round(project.current_percentage)}%</span>
          </div>
          <div style={{ height: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ width: `${project.current_percentage}%`, height: '100%', background: '#3b82f6', transition: 'width 0.8s ease-out' }} />
          </div>
        </div>
        <div style={{ width: '1px', height: '40px', background: 'rgba(255,255,255,0.2)' }} />
        <div style={{ display: 'flex', gap: '2rem' }}>
          <div>
            <div style={{ color: '#9ca3af', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Start Date</div>
            <div style={{ fontWeight: 600 }}>{project.start_date ? new Date(project.start_date).toLocaleDateString() : 'N/A'}</div>
          </div>
          <div>
            <div style={{ color: '#9ca3af', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Expected End</div>
            <div style={{ fontWeight: 600 }}>{project.expected_end_date ? new Date(project.expected_end_date).toLocaleDateString() : 'N/A'}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
        {/* Left Column: Checklist */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Milestone Checklist</h2>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>Mark tasks to update progress automatically</p>
          </div>
          <div style={{ padding: '1rem' }}>
            {project.tasks.map((task: any) => (
              <div 
                key={task.id} 
                onClick={() => handleToggleTask(task.id, task.is_completed)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1rem', 
                  padding: '1rem', 
                  borderRadius: '8px', 
                  cursor: 'pointer', 
                  background: task.is_completed ? '#f0fdf4' : 'transparent',
                  transition: 'all 0.2s',
                  border: '1px solid transparent',
                  marginBottom: '0.5rem'
                }}
                className="task-item"
              >
                {task.is_completed ? 
                  <CheckCircle2 size={24} style={{ color: '#10b981' }} /> : 
                  <Circle size={24} style={{ color: '#d1d5db' }} />
                }
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, color: task.is_completed ? '#065f46' : '#111827' }}>{task.task_name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Weight: {task.weight}%</div>
                </div>
                {task.is_completed && task.completed_at && (
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    Done {new Date(task.completed_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Daily Updates</h2>
              <button 
                onClick={() => setIsLogModalOpen(true)}
                style={{ background: '#111827', color: 'white', border: 'none', borderRadius: '6px', padding: '0.4rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <Plus size={14} /> Log Update
              </button>
            </div>
            
            <div style={{ padding: '1.5rem', maxHeight: '600px', overflowY: 'auto' }}>
              <div style={{ borderLeft: '2px solid #e5e7eb', paddingLeft: '1.5rem', position: 'relative' }}>
                {project.logs.length === 0 ? (
                  <div style={{ color: '#9ca3af', fontSize: '0.875rem', fontStyle: 'italic', marginLeft: '-1.5rem', paddingLeft: '1.5rem' }}>No updates logged yet.</div>
                ) : (
                  project.logs.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((log: any) => (
                    <div key={log.id} style={{ marginBottom: '1.5rem', position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '-1.5rem', top: '0.25rem', width: '10px', height: '10px', background: '#1a56db', borderRadius: '50%', transform: 'translateX(-50%)', border: '2px solid white' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#111827' }}>{new Date(log.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>at {Math.round(log.percentage_at_time)}%</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#4b5563', lineHeight: 1.5 }}>{log.remarks}</p>
                      <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.25rem' }}>By {log.user_name || 'System'}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Log Modal */}
      {isLogModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '500px', padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>Add Daily Update</h2>
            <form onSubmit={handleAddLog}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Date</label>
                <input required type="date" value={logFormData.date} onChange={e => setLogFormData({...logFormData, date: e.target.value})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Remarks / Activity</label>
                <textarea 
                  required 
                  rows={4}
                  value={logFormData.remarks} 
                  onChange={e => setLogFormData({...logFormData, remarks: e.target.value})} 
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db', resize: 'none' }} 
                  placeholder="What work was completed today?"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setIsLogModalOpen(false)} style={{ padding: '0.5rem 1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '0.5rem 1rem', background: '#111827', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Save Log</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '600px', padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>Edit Project Details</h2>
            <form onSubmit={handleUpdateProject}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>POC Name</label>
                  <input type="text" value={editFormData.poc_name} onChange={e => setEditFormData({...editFormData, poc_name: e.target.value})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Version Details</label>
                  <input type="text" value={editFormData.version_details} onChange={e => setEditFormData({...editFormData, version_details: e.target.value})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Status</label>
                  <select value={editFormData.status} onChange={e => setEditFormData({ ...editFormData, status: e.target.value })} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white' }}>
                    <option value="InProgress">In Progress</option>
                    <option value="OnHold">On Hold</option>
                    <option value="Live">Live</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>PO Date</label>
                  <input type="date" value={editFormData.po_date} onChange={e => setEditFormData({...editFormData, po_date: e.target.value})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Start Date</label>
                  <input type="date" value={editFormData.start_date} onChange={e => setEditFormData({...editFormData, start_date: e.target.value})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Expected End</label>
                  <input type="date" value={editFormData.expected_end_date} onChange={e => setEditFormData({...editFormData, expected_end_date: e.target.value})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setIsEditModalOpen(false)} style={{ padding: '0.5rem 1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '0.5rem 1rem', background: '#1a56db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Update Project</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImplementationDetail;
