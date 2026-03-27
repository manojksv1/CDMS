import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useNotificationStore } from '../store/notificationStore';
import { useAuthStore } from '../store/authStore';
import { 
  ArrowLeft, 
  Settings, 
  Plus, 
  CheckCircle2, 
  Circle,
  TrendingUp,
  Target,
  User,
  X,
  MessageSquare,
  ListChecks,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Save,
  CheckSquare,
  Square
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

const ImplementationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const currentUser = useAuthStore(state => state.user);
  
  // Modal states
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(["DMS Implementation"]);
  const [pendingTasks, setPendingTasks] = useState<{[key: number]: boolean}>({});
  
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
    status: '',
    assigned_user_id: ''
  });

  const showNotification = useNotificationStore(state => state.show);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const requests: Promise<any>[] = [api.get(`/implementations/${id}`)];
      if (currentUser?.role !== 'ENGINEER') {
        requests.push(api.get('/users/'));
      }
      
      const [projectRes, usersRes] = await Promise.all(requests);
      
      setProject(projectRes.data);
      setEditFormData({
        poc_name: projectRes.data.poc_name || '',
        version_details: projectRes.data.version_details || '',
        po_date: projectRes.data.po_date || '',
        start_date: projectRes.data.start_date || '',
        expected_end_date: projectRes.data.expected_end_date || '',
        status: projectRes.data.status || 'InProgress',
        assigned_user_id: projectRes.data.assigned_user_id ? String(projectRes.data.assigned_user_id) : ''
      });

      if (usersRes) {
        setUsers(usersRes.data.filter((u: any) => u.role === 'ENGINEER'));
      }

    } catch (err) {
      console.error(err);
      showNotification("Failed to load project details", "error");
      navigate('/implementations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTask = (taskId: number, currentStatus: boolean) => {
    // 1. Update project state locally for instant UI feedback
    setProject((prev: any) => {
      const updatedTasks = prev.tasks.map((t: any) => 
        t.id === taskId ? { ...t, is_completed: !currentStatus, completed_at: !currentStatus ? new Date().toISOString() : null } : t
      );
      
      // Calculate local percentage
      const newPercentage = updatedTasks.reduce((acc: number, t: any) => 
        acc + (t.is_completed ? t.weight : 0), 0
      );

      return { ...prev, tasks: updatedTasks, current_percentage: newPercentage };
    });

    // 2. Track as pending change
    setPendingTasks(prev => {
      const next = { ...prev };
      next[taskId] = !currentStatus;
      return next;
    });
  };

  const handleSaveTasks = async () => {
    const updates = Object.entries(pendingTasks).map(([id, is_completed]) => ({
      id: parseInt(id),
      is_completed
    }));

    if (updates.length === 0) return;

    try {
      await api.patch('/implementations/tasks-bulk/update', updates);
      showNotification(`${updates.length} tasks updated successfully`, "success");
      setPendingTasks({});
      fetchData(); // Sync with server for full accuracy
    } catch (err) {
      console.error(err);
      showNotification("Failed to save task updates", "error");
    }
  };

  const toggleSectionCompletion = (sectionName: string) => {
    const sectionTasks = sections[sectionName];
    const allCompleted = sectionTasks.every((t: any) => t.is_completed);
    const targetStatus = !allCompleted;

    const newPending = { ...pendingTasks };
    
    setProject((prev: any) => {
      const updatedTasks = prev.tasks.map((t: any) => {
        if (t.section_name === sectionName || (!t.section_name && sectionName === "General")) {
          newPending[t.id] = targetStatus;
          return { ...t, is_completed: targetStatus, completed_at: targetStatus ? new Date().toISOString() : null };
        }
        return t;
      });

      const newPercentage = updatedTasks.reduce((acc: number, t: any) => 
        acc + (t.is_completed ? t.weight : 0), 0
      );

      return { ...prev, tasks: updatedTasks, current_percentage: newPercentage };
    });

    setPendingTasks(newPending);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Always send today's date
      const payload = {
        ...logFormData,
        date: new Date().toISOString().split('T')[0]
      };
      await api.post(`/implementations/${id}/logs`, payload);
      showNotification("Daily log added!", "success");
      setIsLogModalOpen(false);
      setLogFormData({ date: new Date().toISOString().split('T')[0], remarks: '' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { 
        ...editFormData, 
        assigned_user_id: editFormData.assigned_user_id ? parseInt(editFormData.assigned_user_id, 10) : null,
        po_date: editFormData.po_date || null,
        start_date: editFormData.start_date || null,
        expected_end_date: editFormData.expected_end_date || null
      };
      
      await api.patch(`/implementations/${id}`, payload);
      showNotification("Project updated successfully!", "success");
      setIsEditModalOpen(false);
      fetchData();
    } catch (err) {
      console.error("UPDATE FAILED:", err); 
    }
  };

  const handleSyncTemplate = async () => {
    setIsSyncModalOpen(false);
    try {
      const res = await api.post(`/implementations/${id}/sync-template`);
      showNotification(res.data.message, "success");
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) return <div className="p-10 text-center">Loading project details...</div>;
  if (!project) return null;

  // Group tasks by section
  const sections = project.tasks.reduce((acc: any, task: any) => {
    const s = task.section_name || "General";
    if (!acc[s]) acc[s] = [];
    acc[s].push(task);
    return acc;
  }, {});

  // Sort tasks within each section by ID
  Object.keys(sections).forEach(sectionName => {
    sections[sectionName].sort((a: any, b: any) => a.id - b.id);
  });

  const formatInTimezone = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    
    // Ensure the date string is treated as UTC if it lacks timezone info
    const utcDateStr = dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`;
    const date = new Date(utcDateStr);
    
    const tz = currentUser?.timezone || 'UTC';
    
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch (e) {
      // Fallback if timezone is invalid
      return date.toLocaleString();
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ConfirmModal 
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onConfirm={handleSyncTemplate}
        title="Sync Master Template"
        message="This will add any new milestones from the master template to this project. Existing progress will be saved. Continue?"
        type="info"
        confirmText="Sync Now"
      />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button onClick={() => navigate('/implementations')} style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827', margin: 0 }}>{project.company_name}</h1>
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.375rem' }}><User size={16} /> POC: {project.poc_name || 'None'}</span>
            <span style={{ fontSize: '0.875rem', color: '#1a56db', display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 500 }}><User size={16} /> Engineer: {project.assigned_user_name || 'Unassigned'}</span>
            <span style={{ fontSize: '0.875rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.375rem' }}><TrendingUp size={16} /> Version: {project.version_details || 'N/A'}</span>
            <span style={{ fontSize: '0.875rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.375rem' }}><Target size={16} /> Status: <strong style={{ color: '#111827' }}>{project.status}</strong></span>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem' }}>
          <button 
            onClick={() => setIsSyncModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', border: '1px solid #d1d5db', padding: '0.625rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: '#059669' }}
          >
            <RefreshCw size={18} /> Sync Template
          </button>
          <button onClick={() => setIsEditModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', border: '1px solid #d1d5db', padding: '0.625rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
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
            <div style={{ width: `${Math.min(100, project.current_percentage)}%`, height: '100%', background: '#3b82f6', transition: 'width 0.8s ease-out' }} />
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '2rem', alignItems: 'start' }}>
        {/* Left Column: Daily Updates */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageSquare size={18} style={{ color: '#1a56db' }} />
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Activity & Daily Updates</h2>
            </div>
            <button onClick={() => setIsLogModalOpen(true)} style={{ background: '#111827', color: 'white', border: 'none', borderRadius: '6px', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem' }}><Plus size={16} /> Log Update</button>
          </div>
          
          <div style={{ padding: '2rem' }}>
            <div style={{ borderLeft: '2px solid #e5e7eb', paddingLeft: '2rem', position: 'relative' }}>
              {project.logs.length === 0 ? (
                <div style={{ color: '#9ca3af', fontSize: '0.875rem', fontStyle: 'italic', marginLeft: '-2rem', paddingLeft: '2rem' }}>No updates logged yet.</div>
              ) : (
                project.logs.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((log: any) => (
                  <div key={log.id} style={{ marginBottom: '2.5rem', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '-2rem', top: '0.25rem', width: '12px', height: '12px', background: '#1a56db', borderRadius: '50%', transform: 'translateX(-50%)', border: '3px solid white', boxShadow: '0 0 0 1px #e5e7eb' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>
                            {formatInTimezone(log.created_at || log.date)}
                          </span>
                        </div>
                        <span style={{ padding: '0.125rem 0.5rem', background: '#eff6ff', color: '#1e40af', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>{Math.round(log.percentage_at_time)}%</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>By {log.user_name || 'System'}</span>
                    </div>
                    <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: '8px', border: '1px solid #f3f4f6' }}>
                      <p style={{ margin: 0, fontSize: '0.9375rem', color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{log.remarks}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Grouped Milestone Checklist */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ListChecks size={18} style={{ color: '#10b981' }} />
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Project Milestones</h2>
            </div>
            {Object.keys(pendingTasks).length > 0 && (
              <button 
                onClick={handleSaveTasks}
                style={{ 
                  background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', 
                  padding: '0.4rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.375rem', animation: 'pulse 2s infinite'
                }}
              >
                <Save size={14} /> Save Changes ({Object.keys(pendingTasks).length})
              </button>
            )}
          </div>
          <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
            {Object.keys(sections).map(sectionName => (
              <div key={sectionName} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <div 
                  style={{ padding: '0.75rem 1rem', background: '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid #1a56db' }}
                >
                  <div 
                    onClick={() => toggleSection(sectionName)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.025em' }}>{sectionName}</span>
                    {expandedSections.includes(sectionName) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleSectionCompletion(sectionName); }}
                    title="Toggle All in Section"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', padding: '0.25rem' }}
                  >
                    {sections[sectionName].every((t: any) => t.is_completed) ? <CheckSquare size={18} style={{ color: '#10b981' }} /> : <Square size={18} />}
                  </button>
                </div>
                
                {expandedSections.includes(sectionName) && (
                  <div style={{ padding: '0.5rem' }}>
                    {sections[sectionName].map((task: any) => (
                      <div 
                        key={task.id} 
                        onClick={() => handleToggleTask(task.id, task.is_completed)}
                        style={{ 
                          display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', 
                          background: task.is_completed ? '#f0fdf4' : 'transparent', transition: 'all 0.2s', border: '1px solid',
                          borderColor: task.is_completed ? '#dcfce7' : 'transparent', marginBottom: '0.25rem',
                          position: 'relative'
                        }}
                      >
                        <div style={{ marginTop: '0.125rem' }}>
                          {task.is_completed ? <CheckCircle2 size={18} style={{ color: '#10b981' }} /> : <Circle size={18} style={{ color: '#d1d5db' }} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: task.is_completed ? '#065f46' : '#111827', lineHeight: 1.4 }}>{task.task_name}</div>
                            {/* NEW Detection: If task created after initial project setup */}
                            {new Date(task.created_at).getTime() > new Date(project.created_at).getTime() + 60000 && (
                              <span style={{ fontSize: '0.6rem', fontWeight: 700, background: '#1a56db', color: 'white', padding: '0.1rem 0.3rem', borderRadius: '4px', textTransform: 'uppercase' }}>New</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                            <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{task.weight}%</span>
                            {task.is_completed && task.completed_at && <span style={{ fontSize: '0.7rem', color: '#10b981' }}>{new Date(task.completed_at).toLocaleDateString()}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Log Modal */}
      {isLogModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '500px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Add Daily Update</h2>
              <button onClick={() => setIsLogModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={24} /></button>
            </div>
            <form onSubmit={handleAddLog}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Remarks / Activity</label>
                <textarea required rows={4} value={logFormData.remarks} onChange={e => setLogFormData({...logFormData, remarks: e.target.value})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db', resize: 'none' }} placeholder="What work was completed today?" />
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Edit Project Details</h2>
              <button onClick={() => setIsEditModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={24} /></button>
            </div>
            <form onSubmit={handleUpdateProject}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>POC Name</label>
                  <input type="text" value={editFormData.poc_name} onChange={e => setEditFormData({...editFormData, poc_name: e.target.value})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                </div>
                {currentUser?.role !== 'ENGINEER' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Assign Engineer</label>
                    <select value={editFormData.assigned_user_id} onChange={e => setEditFormData({...editFormData, assigned_user_id: e.target.value})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white' }}>
                      <option value="">-- Unassigned --</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Version Details</label>
                  <input type="text" value={editFormData.version_details} onChange={e => setEditFormData({...editFormData, version_details: e.target.value})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Status</label>
                  <select value={editFormData.status} onChange={e => setEditFormData({ ...editFormData, status: e.target.value })} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white' }}>
                    <option value="InProgress">In Progress</option>
                    <option value="OnHold">On Hold</option>
                    <option value="Live">Live</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>PO Date</label>
                  <input type="date" value={editFormData.po_date} onChange={e => setEditFormData({...editFormData, po_date: e.target.value})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Start Date</label>
                  <input type="date" value={editFormData.start_date} onChange={e => setEditFormData({...editFormData, start_date: e.target.value})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
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
