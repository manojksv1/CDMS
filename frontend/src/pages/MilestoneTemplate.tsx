import React, { useEffect, useState } from 'react';
import api from '../api';
import { useNotificationStore } from '../store/notificationStore';
import { 
  Plus, 
  Trash2, 
  AlertCircle,
  GripVertical,
  Edit2,
  Layout,
  CheckCircle2
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const MilestoneTemplate: React.FC = () => {
  const [sections, setSections] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<any>(null);
  const [editingTask, setEditingTask] = useState<any>(null);

  const currentUser = useAuthStore(state => state.user);

  const showNotification = useNotificationStore(state => state.show);

  const [sectionFormData, setSectionFormData] = useState({ name: '', weight: 0 });
  const [taskFormData, setTaskFormData] = useState({ task_name: '', weight: 0, section_id: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/implementations/sections/');
      setSections(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Section CRUD ---
  const handleSectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSection) {
        await api.patch(`/implementations/sections/${editingSection.id}`, sectionFormData);
        showNotification("Section updated", "success");
      } else {
        await api.post('/implementations/sections/', sectionFormData);
        showNotification("Section created", "success");
      }
      setIsSectionModalOpen(false);
      setEditingSection(null);
      setSectionFormData({ name: '', weight: 0 });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const deleteSection = async (id: number) => {
    if (window.confirm("Deleting a section will delete all tasks inside it. Continue?")) {
      await api.delete(`/implementations/sections/${id}`);
      fetchData();
    }
  };

  // --- Task CRUD ---
  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTask) {
        await api.patch(`/implementations/templates/${editingTask.id}`, taskFormData);
        showNotification("Task updated", "success");
      } else {
        await api.post('/implementations/templates/', taskFormData);
        showNotification("Task added to section", "success");
      }
      setIsTaskModalOpen(false);
      setEditingTask(null);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const deleteTask = async (id: number) => {
    if (window.confirm("Remove this task?")) {
      await api.delete(`/implementations/templates/${id}`);
      fetchData();
    }
  };

  const openTaskModal = (sectionId: number, task?: any) => {
    if (task) {
      setEditingTask(task);
      setTaskFormData({ task_name: task.task_name, weight: task.weight, section_id: sectionId });
    } else {
      setEditingTask(null);
      setTaskFormData({ task_name: '', weight: 0, section_id: sectionId });
    }
    setIsTaskModalOpen(true);
  };

  const totalProjectWeight = sections.reduce((sum, s) => sum + s.weight, 0);

  if (currentUser?.role === 'ENGINEER') return <div className="p-10">Access Denied</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827', marginBottom: '0.25rem' }}>Implementation Template Editor</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Define main milestones and their sub-tasks with percentage weights.</p>
        </div>
        <button 
          onClick={() => { setEditingSection(null); setSectionFormData({name:'', weight:0}); setIsSectionModalOpen(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#111827', color: 'white', padding: '0.625rem 1.25rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600 }}
        >
          <Plus size={18} /> New Main Milestone
        </button>
      </div>

      {/* Global Status */}
      <div style={{ background: totalProjectWeight === 100 ? '#ecfdf5' : '#fff7ed', border: '1px solid', borderColor: totalProjectWeight === 100 ? '#10b981' : '#f97316', padding: '1rem 1.5rem', borderRadius: '12px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {totalProjectWeight === 100 ? <CheckCircle2 size={24} color="#059669" /> : <AlertCircle size={24} color="#d97706" />}
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 700, color: totalProjectWeight === 100 ? '#065f46' : '#9a3412' }}>Total Project Weight: {totalProjectWeight}%</span>
          <p style={{ margin: 0, fontSize: '0.75rem', color: totalProjectWeight === 100 ? '#047857' : '#c2410c' }}>
            {totalProjectWeight === 100 ? "Valid 100% configuration." : `The sum of all main milestones must be exactly 100% (Current: ${totalProjectWeight}%).`}
          </p>
        </div>
      </div>

      {isLoading ? <div className="text-center p-20">Loading master template...</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(500px, 1fr))', gap: '2rem' }}>
          {sections.map(section => {
            const tasksWeight = section.milestones.reduce((sum: number, m: any) => sum + m.weight, 0);
            const isBalanced = Math.abs(tasksWeight - section.weight) < 0.01;

            return (
              <div key={section.id} style={{ background: 'white', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                {/* Section Header */}
                <div style={{ padding: '1.25rem', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Layout size={18} color="#1a56db" />
                      <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{section.name}</h2>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1a56db', background: '#eff6ff', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Target: {section.weight}%</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isBalanced ? '#059669' : '#d97706' }}>Sub-tasks: {tasksWeight}%</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button onClick={() => { setEditingSection(section); setSectionFormData({name: section.name, weight: section.weight}); setIsSectionModalOpen(true); }} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '0.4rem' }}><Edit2 size={16} /></button>
                    <button onClick={() => deleteSection(section.id)} style={{ background: 'none', border: 'none', color: '#fecaca', cursor: 'pointer', padding: '0.4rem' }}><Trash2 size={16} /></button>
                  </div>
                </div>

                {/* Tasks List */}
                <div style={{ padding: '1rem' }}>
                  {section.milestones.map((task: any) => (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', borderRadius: '8px', border: '1px solid #f3f4f6', marginBottom: '0.5rem' }}>
                      <GripVertical size={16} color="#d1d5db" />
                      <div style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500 }}>{task.task_name}</div>
                      <div style={{ fontWeight: 700, color: '#4b5563', fontSize: '0.875rem' }}>{task.weight}%</div>
                      <div style={{ display: 'flex', gap: '0.1rem' }}>
                         <button onClick={() => openTaskModal(section.id, task)} style={{ background: 'none', border: 'none', color: '#1a56db', cursor: 'pointer', padding: '0.3rem' }}><Edit2 size={14} /></button>
                         <button onClick={() => deleteTask(task.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.3rem' }}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                  <button 
                    onClick={() => openTaskModal(section.id)}
                    style={{ width: '100%', padding: '0.75rem', background: 'transparent', border: '2px dashed #e5e7eb', borderRadius: '8px', color: '#6b7280', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                  >
                    <Plus size={14} /> Add Sub-task
                  </button>
                </div>
                
                {!isBalanced && (
                   <div style={{ padding: '0.5rem 1rem', background: '#fff7ed', color: '#c2410c', fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                     <AlertCircle size={12} /> Tasks sum ({tasksWeight}%) does not match section target ({section.weight}%)
                   </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Section Modal */}
      {isSectionModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '450px', padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>{editingSection ? 'Edit Main Milestone' : 'New Main Milestone'}</h2>
            <form onSubmit={handleSectionSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Milestone Name</label>
                <input required type="text" value={sectionFormData.name} onChange={e => setSectionFormData({...sectionFormData, name: e.target.value})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }} placeholder="e.g. Contentverse Installation" />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Total Weight (%)</label>
                <input required type="number" step="0.1" value={sectionFormData.weight} onChange={e => setSectionFormData({...sectionFormData, weight: parseFloat(e.target.value)})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setIsSectionModalOpen(false)} style={{ padding: '0.5rem 1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '0.5rem 1rem', background: '#111827', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>{editingSection ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {isTaskModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '450px', padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>{editingTask ? 'Edit Sub-task' : 'Add Sub-task'}</h2>
            <form onSubmit={handleTaskSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Task Name</label>
                <input required type="text" value={taskFormData.task_name} onChange={e => setTaskFormData({...taskFormData, task_name: e.target.value})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Task Weight (%)</label>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.7rem', color: '#6b7280' }}>This is the percentage contribution to the TOTAL project.</p>
                <input required type="number" step="0.1" value={taskFormData.weight} onChange={e => setTaskFormData({...taskFormData, weight: parseFloat(e.target.value)})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setIsTaskModalOpen(false)} style={{ padding: '0.5rem 1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '0.5rem 1rem', background: '#1a56db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>{editingTask ? 'Update' : 'Add Task'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MilestoneTemplate;
