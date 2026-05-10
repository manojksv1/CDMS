import React, { useEffect, useState, useCallback } from 'react';
import api from '../api';
import { useNotificationStore } from '../store/notificationStore';
import { Plus, Trash2, AlertCircle, GripVertical, Edit2, Layout, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';
import { Skeleton } from '../components/Skeleton';
import type { MilestoneSection, GlobalMilestone } from '../types/api';

const MilestoneTemplate: React.FC = () => {
  const [sections, setSections] = useState<MilestoneSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<MilestoneSection | null>(null);
  const [editingTask, setEditingTask] = useState<GlobalMilestone | null>(null);
  const [sectionForm, setSectionForm] = useState({ name: '', weight: 0 });
  const [taskForm, setTaskForm] = useState({ task_name: '', weight: 0, section_id: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false, title: '', message: '', onConfirm: () => {},
    type: 'danger' as 'danger' | 'warning' | 'info', confirmText: 'Delete',
  });

  const currentUser = useAuthStore((s) => s.user);
  const showNotification = useNotificationStore((s) => s.show);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<MilestoneSection[]>('/implementations/sections/');
      setSections(res.data);
    } catch { /* handled */ } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingSection) {
        await api.patch(`/implementations/sections/${editingSection.id}`, sectionForm);
        showNotification('Section updated', 'success');
      } else {
        await api.post('/implementations/sections/', sectionForm);
        showNotification('Section created', 'success');
      }
      setIsSectionModalOpen(false);
      setEditingSection(null);
      setSectionForm({ name: '', weight: 0 });
      fetchData();
    } catch { /* handled */ } finally { setIsSubmitting(false); }
  };

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingTask) {
        await api.patch(`/implementations/templates/${editingTask.id}`, taskForm);
        showNotification('Task updated', 'success');
      } else {
        await api.post('/implementations/templates/', taskForm);
        showNotification('Task added', 'success');
      }
      setIsTaskModalOpen(false);
      setEditingTask(null);
      fetchData();
    } catch { /* handled */ } finally { setIsSubmitting(false); }
  };

  const deleteSection = (id: number) => {
    setConfirmConfig({
      isOpen: true, title: 'Delete Section', type: 'danger', confirmText: 'Delete Section',
      message: 'Deleting this section will also delete all tasks inside it. Continue?',
      onConfirm: async () => {
        setConfirmConfig((p) => ({ ...p, isOpen: false }));
        try { await api.delete(`/implementations/sections/${id}`); fetchData(); } catch { /* handled */ }
      },
    });
  };

  const deleteTask = (id: number) => {
    setConfirmConfig({
      isOpen: true, title: 'Remove Task', type: 'danger', confirmText: 'Remove Task',
      message: 'New projects will no longer include this milestone. Continue?',
      onConfirm: async () => {
        setConfirmConfig((p) => ({ ...p, isOpen: false }));
        try { await api.delete(`/implementations/templates/${id}`); fetchData(); } catch { /* handled */ }
      },
    });
  };

  const openTaskModal = (sectionId: number, task?: GlobalMilestone) => {
    if (task) {
      setEditingTask(task);
      setTaskForm({ task_name: task.task_name, weight: task.weight, section_id: sectionId });
    } else {
      setEditingTask(null);
      setTaskForm({ task_name: '', weight: 0, section_id: sectionId });
    }
    setIsTaskModalOpen(true);
  };

  const totalWeight = sections.reduce((s, sec) => s + sec.weight, 0);

  if (currentUser?.role === 'ENGINEER') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Access denied. Admins and Managers only.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <ConfirmModal {...confirmConfig} onClose={() => setConfirmConfig((p) => ({ ...p, isOpen: false }))} />

      <div className="page-header">
        <div>
          <h1 className="page-title">Implementation Template Editor</h1>
          <p className="page-subtitle">Define milestones and sub-tasks with percentage weights.</p>
        </div>
        <button
          onClick={() => { setEditingSection(null); setSectionForm({ name: '', weight: 0 }); setIsSectionModalOpen(true); }}
          className="btn-dark"
        >
          <Plus size={16} /> New Milestone
        </button>
      </div>

      {/* Weight status */}
      <div className={`flex items-center gap-3 px-5 py-3 rounded-xl mb-6 border ${
        totalWeight === 100
          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
          : 'bg-amber-50 border-amber-300 text-amber-800'
      }`}>
        {totalWeight === 100
          ? <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />
          : <AlertCircle size={20} className="text-amber-500 flex-shrink-0" />
        }
        <div>
          <span className="font-bold">Total Project Weight: {totalWeight}%</span>
          <p className="text-xs mt-0.5">
            {totalWeight === 100
              ? 'Valid 100% configuration.'
              : `All milestones must sum to exactly 100% (current: ${totalWeight}%).`}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-5">
          {sections.map((section) => {
            const tasksWeight = section.milestones.reduce((s, m) => s + m.weight, 0);
            const isBalanced = Math.abs(tasksWeight - section.weight) < 0.01;

            return (
              <div key={section.id} className="card overflow-hidden">
                {/* Section header */}
                <div className="card-header flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Layout size={16} className="text-blue-600" aria-hidden="true" />
                      <h2 className="font-bold text-gray-900">{section.name}</h2>
                    </div>
                    <div className="flex gap-3 mt-1">
                      <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        Target: {section.weight}%
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${isBalanced ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
                        Sub-tasks: {tasksWeight}%
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setEditingSection(section); setSectionForm({ name: section.name, weight: section.weight }); setIsSectionModalOpen(true); }}
                      className="btn-ghost" aria-label={`Edit section ${section.name}`}
                    >
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => deleteSection(section.id)} className="btn-ghost text-red-500 hover:bg-red-50" aria-label={`Delete section ${section.name}`}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Tasks */}
                <div className="p-4 space-y-2">
                  {section.milestones.map((task) => (
                    <div key={task.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                      <GripVertical size={15} className="text-gray-300 flex-shrink-0" aria-hidden="true" />
                      <span className="flex-1 text-sm font-medium text-gray-800">{task.task_name}</span>
                      <span className="text-sm font-bold text-gray-500">{task.weight}%</span>
                      <div className="flex gap-1">
                        <button onClick={() => openTaskModal(section.id, task)} className="btn-ghost" aria-label={`Edit task ${task.task_name}`}>
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => deleteTask(task.id)} className="btn-ghost text-red-500 hover:bg-red-50" aria-label={`Delete task ${task.task_name}`}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => openTaskModal(section.id)}
                    className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 font-medium hover:border-gray-300 hover:text-gray-700 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus size={14} /> Add Sub-task
                  </button>
                </div>

                {!isBalanced && (
                  <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 flex items-center gap-2 text-xs text-amber-700 font-medium">
                    <AlertCircle size={12} />
                    Tasks sum ({tasksWeight}%) ≠ section target ({section.weight}%)
                  </div>
                )}
              </div>
            );
          })}

          {sections.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Layout size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No milestones yet</p>
              <p className="text-sm mt-1">Create your first milestone to get started.</p>
            </div>
          )}
        </div>
      )}

      {/* Section Modal */}
      <Modal isOpen={isSectionModalOpen} onClose={() => setIsSectionModalOpen(false)}
        title={editingSection ? 'Edit Milestone' : 'New Milestone'}
        footer={
          <>
            <button onClick={() => setIsSectionModalOpen(false)} className="btn-secondary">Cancel</button>
            <button form="section-form" type="submit" disabled={isSubmitting} className="btn-dark">
              {isSubmitting ? 'Saving…' : editingSection ? 'Update' : 'Create'}
            </button>
          </>
        }
      >
        <form id="section-form" onSubmit={handleSectionSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="sec-name" className="label">Milestone Name <span className="text-red-500">*</span></label>
            <input id="sec-name" required type="text" value={sectionForm.name}
              onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
              className="input" placeholder="e.g. Contentverse Installation" />
          </div>
          <div className="form-group">
            <label htmlFor="sec-weight" className="label">Total Weight (%) <span className="text-red-500">*</span></label>
            <input id="sec-weight" required type="number" step="0.1" min="0" max="100"
              value={sectionForm.weight}
              onChange={(e) => setSectionForm({ ...sectionForm, weight: parseFloat(e.target.value) || 0 })}
              className="input" />
          </div>
        </form>
      </Modal>

      {/* Task Modal */}
      <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)}
        title={editingTask ? 'Edit Sub-task' : 'Add Sub-task'}
        footer={
          <>
            <button onClick={() => setIsTaskModalOpen(false)} className="btn-secondary">Cancel</button>
            <button form="task-form" type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Saving…' : editingTask ? 'Update' : 'Add Task'}
            </button>
          </>
        }
      >
        <form id="task-form" onSubmit={handleTaskSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="task-name" className="label">Task Name <span className="text-red-500">*</span></label>
            <input id="task-name" required type="text" value={taskForm.task_name}
              onChange={(e) => setTaskForm({ ...taskForm, task_name: e.target.value })}
              className="input" />
          </div>
          <div className="form-group">
            <label htmlFor="task-weight" className="label">Task Weight (%) <span className="text-red-500">*</span></label>
            <p className="text-xs text-gray-500 mb-1">Percentage contribution to the total project.</p>
            <input id="task-weight" required type="number" step="0.1" min="0"
              value={taskForm.weight}
              onChange={(e) => setTaskForm({ ...taskForm, weight: parseFloat(e.target.value) || 0 })}
              className="input" />
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default MilestoneTemplate;
