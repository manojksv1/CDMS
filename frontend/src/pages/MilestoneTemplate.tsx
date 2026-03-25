import React, { useEffect, useState } from 'react';
import api from '../api';
import { useNotificationStore } from '../store/notificationStore';
import { 
  Plus, 
  Trash2, 
  AlertCircle,
  GripVertical,
  Edit2,
  X
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const MilestoneTemplate: React.FC = () => {
  const [milestones, setMilestones] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<any>(null);
  
  // Drag and drop state
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  const currentUser = useAuthStore(state => state.user);
  const showNotification = useNotificationStore(state => state.show);

  const [formData, setFormData] = useState({
    task_name: '',
    section: 'DMS Implementation',
    weight: 0
  });

  const [editFormData, setEditFormData] = useState({
    task_name: '',
    section: '',
    weight: 0
  });

  useEffect(() => {
    fetchMilestones();
  }, []);

  const fetchMilestones = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/implementations/templates/');
      const sorted = res.data.sort((a: any, b: any) => a.order - b.order);
      setMilestones(sorted);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const nextOrder = milestones.length > 0 ? Math.max(...milestones.map(m => m.order)) + 1 : 0;
      await api.post('/implementations/templates/', { ...formData, order: nextOrder });
      showNotification("Milestone added!", "success");
      setIsModalOpen(false);
      setFormData({ task_name: '', section: 'DMS Implementation', weight: 0 });
      fetchMilestones();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.patch(`/implementations/templates/${selectedMilestone.id}`, editFormData);
      showNotification("Milestone updated!", "success");
      setIsEditModalOpen(false);
      fetchMilestones();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Are you sure? New projects will no longer include this milestone.")) {
      try {
        await api.delete(`/implementations/templates/${id}`);
        showNotification("Milestone removed", "info");
        fetchMilestones();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // --- Drag and Drop Handlers ---
  
  const handleDragStart = (index: number) => {
    setDraggedItemIndex(index);
  };

  const handleDragEnter = (_e: React.DragEvent, index: number) => {
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    
    const newMilestones = [...milestones];
    const draggedItem = newMilestones[draggedItemIndex];
    
    // Remove the item from its old position and insert at new position
    newMilestones.splice(draggedItemIndex, 1);
    newMilestones.splice(index, 0, draggedItem);
    
    setDraggedItemIndex(index);
    setMilestones(newMilestones);
  };

  const handleDragEnd = async () => {
    setDraggedItemIndex(null);
    try {
      // Sync the new order with backend
      const ids = milestones.map(m => m.id);
      await api.post('/implementations/templates/bulk-reorder', ids);
      showNotification("Order saved successfully", "success");
    } catch (err) {
      console.error("Failed to save order", err);
    }
  };

  const openEditModal = (m: any) => {
    setSelectedMilestone(m);
    setEditFormData({
      task_name: m.task_name,
      section: m.section,
      weight: m.weight
    });
    setIsEditModalOpen(true);
  };

  const totalPercentage = milestones.reduce((sum, m) => sum + m.weight, 0);

  if (currentUser?.role === 'ENGINEER') return <div className="p-10">Access Denied</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827', marginBottom: '0.25rem' }}>Master Milestone Template</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Drag handles to reorder. Configure default checklist and % weights.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#1a56db', color: 'white', padding: '0.625rem 1.25rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600 }}
        >
          <Plus size={18} /> Add Task
        </button>
      </div>

      {/* Summary Card */}
      <div style={{ background: totalPercentage === 100 ? '#ecfdf5' : '#fff7ed', border: '1px solid', borderColor: totalPercentage === 100 ? '#10b981' : '#f97316', padding: '1.25rem', borderRadius: '12px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <AlertCircle style={{ color: totalPercentage === 100 ? '#059669' : '#d97706' }} size={24} />
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: totalPercentage === 100 ? '#065f46' : '#9a3412' }}>
            Current Total: {totalPercentage.toFixed(1)}%
          </h3>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: totalPercentage === 100 ? '#047857' : '#c2410c' }}>
            {totalPercentage === 100 
              ? "Perfect! The template adds up to exactly 100%." 
              : `Warning: The template should total exactly 100%. Adjust weights to fix the ${Math.abs(100 - totalPercentage).toFixed(1)}% difference.`}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center p-10">Loading template data...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {milestones.map((m, index) => (
            <div 
              key={m.id} 
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              style={{ 
                background: draggedItemIndex === index ? '#f8fafc' : 'white', 
                opacity: draggedItemIndex === index ? 0.5 : 1,
                borderRadius: '10px', 
                border: '1px solid #e5e7eb', 
                padding: '0.75rem 1.25rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '1rem', 
                boxShadow: draggedItemIndex === index ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
                cursor: 'grab',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
            >
              <div style={{ color: '#d1d5db' }}>
                <GripVertical size={20} />
              </div>
              
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '0.125rem 0.4rem', background: '#f1f5f9', color: '#475569', borderRadius: '4px', textTransform: 'uppercase' }}>{m.section}</span>
                  <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>{m.task_name}</h3>
                </div>
              </div>

              <div style={{ background: '#f0fdf4', color: '#166534', padding: '0.3rem 0.7rem', borderRadius: '6px', fontWeight: 700, fontSize: '0.8125rem', minWidth: '55px', textAlign: 'center' }}>
                {m.weight}%
              </div>

              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button onClick={() => openEditModal(m)} style={{ background: 'none', border: 'none', color: '#1a56db', cursor: 'pointer', padding: '0.5rem' }} title="Edit"><Edit2 size={16} /></button>
                <button onClick={() => handleDelete(m.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.5rem' }} title="Delete"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '500px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Add Milestone Task</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={24} /></button>
            </div>
            <form onSubmit={handleAdd}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Task Name</label>
                <input required type="text" value={formData.task_name} onChange={e => setFormData({...formData, task_name: e.target.value})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Section</label>
                <select value={formData.section} onChange={e => setFormData({...formData, section: e.target.value})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white' }}>
                  <option value="DMS Implementation">DMS Implementation</option>
                  <option value="Planning">Planning</option>
                  <option value="Configuration">Configuration</option>
                  <option value="Testing">Testing</option>
                  <option value="Training">Training</option>
                  <option value="Admin Training">Admin Training</option>
                  <option value="Sign Off">Sign Off</option>
                </select>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Weight (%)</label>
                <input required type="number" step="0.1" value={formData.weight} onChange={e => setFormData({...formData, weight: parseFloat(e.target.value)})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '0.5rem 1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '0.5rem 1rem', background: '#1a56db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Save to Template</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '500px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Edit Milestone Task</h2>
              <button onClick={() => setIsEditModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={24} /></button>
            </div>
            <form onSubmit={handleEdit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Task Name</label>
                <input required type="text" value={editFormData.task_name} onChange={e => setEditFormData({...editFormData, task_name: e.target.value})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Section</label>
                <select value={editFormData.section} onChange={e => setEditFormData({...editFormData, section: e.target.value})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white' }}>
                  <option value="DMS Implementation">DMS Implementation</option>
                  <option value="Planning">Planning</option>
                  <option value="Configuration">Configuration</option>
                  <option value="Testing">Testing</option>
                  <option value="Training">Training</option>
                  <option value="Admin Training">Admin Training</option>
                  <option value="Sign Off">Sign Off</option>
                </select>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Weight (%)</label>
                <input required type="number" step="0.1" value={editFormData.weight} onChange={e => setEditFormData({...editFormData, weight: parseFloat(e.target.value)})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setIsEditModalOpen(false)} style={{ padding: '0.5rem 1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '0.5rem 1rem', background: '#1a56db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Update Milestone</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MilestoneTemplate;
