import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useNotificationStore } from '../store/notificationStore';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import {
  ArrowLeft, Settings, Plus, CheckCircle2, Circle,
  Target, User, X, MessageSquare, ListChecks,
  ChevronDown, ChevronUp, RefreshCw, Save, CheckSquare,
  Square, Filter,
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';
import { Skeleton } from '../components/Skeleton';
import type {
  ImplementationDetail as ImpDetail,
  ImplementationTask,
  ImplementationUpdate,
  User as UserType,
  ImplementationStatus,
} from '../types/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SectionMap {
  [sectionName: string]: ImplementationTask[];
}

interface EditForm {
  poc_1: string; poc_2: string; license_uat: string; license_prod: string;
  uat_version: string; prod_version: string; po_date: string;
  start_date: string; expected_end_date: string;
  status: ImplementationStatus; status_remarks: string; assigned_user_id: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const ImplementationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ImpDetail | null>(null);
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const currentUser = useAuthStore((s) => s.user);

  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [selectedLogSection, setSelectedLogSection] = useState<string | null>(null);
  const [pendingTasks, setPendingTasks] = useState<Record<number, boolean>>({});

  const [logRemarks, setLogRemarks] = useState('');
  const [editForm, setEditForm] = useState<EditForm>({
    poc_1: '', poc_2: '', license_uat: '', license_prod: '',
    uat_version: '', prod_version: '', po_date: '',
    start_date: '', expected_end_date: '',
    status: 'InProgress', status_remarks: '', assigned_user_id: '',
  });

  const showNotification = useNotificationStore((s) => s.show);
  const navigate = useNavigate();
  const appTimezone = useSettingsStore((s) => s.appTimezone);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const requests: Promise<{ data: unknown }>[] = [api.get<ImpDetail>(`/implementations/${id}`)];
      if (currentUser?.role !== 'ENGINEER') {
        requests.push(api.get<UserType[]>('/users/'));
      }
      const [projRes, usersRes] = await Promise.all(requests);
      const proj = (projRes as { data: ImpDetail }).data;
      setProject(proj);
      setEditForm({
        poc_1: proj.poc_1 ?? '', poc_2: proj.poc_2 ?? '',
        license_uat: proj.license_uat ?? '', license_prod: proj.license_prod ?? '',
        uat_version: proj.uat_version ?? '', prod_version: proj.prod_version ?? '',
        po_date: proj.po_date ?? '', start_date: proj.start_date ?? '',
        expected_end_date: proj.expected_end_date ?? '',
        status: proj.status, status_remarks: proj.status_remarks ?? '',
        assigned_user_id: proj.assigned_user_id?.toString() ?? '',
      });
      // Expand all sections by default on first load
      if (expandedSections.length === 0) {
        const sectionNames = [...new Set(proj.tasks.map((t) => t.section_name ?? 'General'))];
        setExpandedSections(sectionNames);
      }
      if (usersRes) {
        setUsers(((usersRes as { data: UserType[] }).data).filter((u) => u.role === 'ENGINEER'));
      }
    } catch {
      showNotification('Failed to load project details', 'error');
      navigate('/implementations');
    } finally {
      setIsLoading(false);
    }
  }, [id, currentUser?.role, navigate, showNotification]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  // ---------------------------------------------------------------------------
  // Task toggling (optimistic)
  // ---------------------------------------------------------------------------
  const handleToggleTask = (taskId: number, currentStatus: boolean, isActive: boolean) => {
    if (!isActive) return;
    setProject((prev) => {
      if (!prev) return prev;
      const updatedTasks = prev.tasks.map((t) =>
        t.id === taskId
          ? { ...t, is_completed: !currentStatus, completed_at: !currentStatus ? new Date().toISOString() : null }
          : t,
      );
      const newPct = updatedTasks.reduce((acc, t) => acc + (t.is_completed && t.is_active ? t.weight : 0), 0);
      return { ...prev, tasks: updatedTasks, current_percentage: newPct };
    });
    setPendingTasks((prev) => ({ ...prev, [taskId]: !currentStatus }));
  };

  const handleSaveTasks = async () => {
    const updates = Object.entries(pendingTasks).map(([tid, is_completed]) => ({
      id: parseInt(tid), is_completed,
    }));
    if (!updates.length) return;
    try {
      await api.patch('/implementations/tasks-bulk/update', { updates });
      showNotification(`${updates.length} tasks saved`, 'success');
      setPendingTasks({});
      fetchData();
    } catch {
      showNotification('Failed to save task updates', 'error');
    }
  };

  const toggleSectionCompletion = (sectionName: string, sectionTasks: ImplementationTask[]) => {
    const active = sectionTasks.filter((t) => t.is_active);
    if (!active.length) return;
    const allDone = active.every((t) => t.is_completed);
    const target = !allDone;
    const newPending = { ...pendingTasks };
    setProject((prev) => {
      if (!prev) return prev;
      const updatedTasks = prev.tasks.map((t) => {
        if (t.is_active && (t.section_name ?? 'General') === sectionName) {
          newPending[t.id] = target;
          return { ...t, is_completed: target, completed_at: target ? new Date().toISOString() : null };
        }
        return t;
      });
      const newPct = updatedTasks.reduce((acc, t) => acc + (t.is_completed && t.is_active ? t.weight : 0), 0);
      return { ...prev, tasks: updatedTasks, current_percentage: newPct };
    });
    setPendingTasks(newPending);
  };

  // ---------------------------------------------------------------------------
  // Log
  // ---------------------------------------------------------------------------
  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/implementations/${id}/logs`, {
        date: new Date().toISOString().split('T')[0],
        remarks: logRemarks,
      });
      showNotification('Daily log added!', 'success');
      setIsLogModalOpen(false);
      setLogRemarks('');
      fetchData();
    } catch { /* handled */ }
  };

  // ---------------------------------------------------------------------------
  // Edit project
  // ---------------------------------------------------------------------------
  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: ImplementationUpdate = {
        ...editForm,
        assigned_user_id: editForm.assigned_user_id ? parseInt(editForm.assigned_user_id) : null,
        po_date: editForm.po_date || null,
        start_date: editForm.start_date || null,
        expected_end_date: editForm.expected_end_date || null,
        status_remarks: editForm.status_remarks || null,
      };
      await api.patch(`/implementations/${id}`, payload);
      showNotification('Project updated!', 'success');
      setIsEditModalOpen(false);
      fetchData();
    } catch { /* handled */ }
  };

  // ---------------------------------------------------------------------------
  // Sync template
  // ---------------------------------------------------------------------------
  const handleSyncTemplate = async () => {
    setIsSyncModalOpen(false);
    try {
      const res = await api.post<{ message: string }>(`/implementations/${id}/sync-template`);
      showNotification(res.data.message, 'success');
      fetchData();
    } catch { /* handled */ }
  };

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------
  const sections: SectionMap = useMemo(() => {
    if (!project) return {};
    const map: SectionMap = {};
    project.tasks.forEach((t) => {
      const key = t.section_name ?? 'General';
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    Object.keys(map).forEach((k) => map[k].sort((a, b) => a.id - b.id));
    return map;
  }, [project]);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    const utc = dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`;
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: appTimezone, weekday: 'short', month: 'short', day: 'numeric',
        year: 'numeric', hour: '2-digit', minute: '2-digit',
      }).format(new Date(utc));
    } catch {
      return new Date(utc).toLocaleString();
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!project) return null;

  const hasPending = Object.keys(pendingTasks).length > 0;

  return (
    <div>
      <ConfirmModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onConfirm={handleSyncTemplate}
        title="Sync Master Template"
        message="This will add new milestones from the master template. Existing progress is preserved. Continue?"
        type="info"
        confirmText="Sync Now"
      />

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <button
          onClick={() => navigate('/implementations')}
          className="btn-secondary p-2 mt-1"
          aria-label="Back to implementations"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{project.company_name}</h1>
          <div className="flex flex-wrap gap-4 mt-1 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <User size={14} aria-hidden="true" /> POC: {project.poc_1 ?? 'None'}
            </span>
            <span className="flex items-center gap-1 text-blue-700 font-medium">
              <User size={14} aria-hidden="true" /> Engineer: {project.assigned_user_name ?? 'Unassigned'}
            </span>
            <span
              className="flex items-center gap-1 cursor-default"
              title={project.status_remarks ?? ''}
            >
              <Target size={14} aria-hidden="true" />
              Status: <strong className="text-gray-900 ml-1">{project.status}</strong>
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {project.status !== 'Live' && project.status !== 'Completed' && (
            <button onClick={() => setIsSyncModalOpen(true)} className="btn-secondary text-emerald-700 border-emerald-300 hover:bg-emerald-50">
              <RefreshCw size={16} /> Sync Template
            </button>
          )}
          <button onClick={() => setIsEditModalOpen(true)} className="btn-secondary">
            <Settings size={16} /> Edit
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-gray-900 rounded-xl p-5 text-white flex items-center gap-6 mb-6">
        <div className="flex-1">
          <div className="flex justify-between mb-2">
            <span className="font-semibold text-sm">Overall Progress</span>
            <span className="font-bold text-xl">{Math.round(project.current_percentage)}%</span>
          </div>
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, project.current_percentage)}%` }}
              role="progressbar"
              aria-valuenow={project.current_percentage}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
        <div className="hidden sm:flex gap-6 text-sm">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Start</p>
            <p className="font-semibold">{project.start_date ? new Date(project.start_date).toLocaleDateString() : 'N/A'}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Target End</p>
            <p className="font-semibold">{project.expected_end_date ? new Date(project.expected_end_date).toLocaleDateString() : 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6 items-start">

        {/* Left — Activity log */}
        <div className="card flex flex-col">
          <div className="card-header flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-blue-600" aria-hidden="true" />
                <h2 className="font-bold text-gray-900">Activity & Daily Updates</h2>
              </div>
              {selectedLogSection && (
                <div className="mt-1.5 inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded">
                  <Filter size={10} /> {selectedLogSection}
                  <button onClick={() => setSelectedLogSection(null)} className="ml-1 hover:text-emerald-900" aria-label="Clear filter">
                    <X size={10} />
                  </button>
                </div>
              )}
            </div>
            <button onClick={() => setIsLogModalOpen(true)} className="btn-dark text-xs py-1.5">
              <Plus size={14} /> Log Update
            </button>
          </div>

          <div className="p-6">
            <div className="border-l-2 border-gray-200 pl-6 space-y-6">
              {project.logs
                .filter((log) => !selectedLogSection || log.milestone_stage === selectedLogSection)
                .sort((a, b) => new Date(b.created_at ?? b.date).getTime() - new Date(a.created_at ?? a.date).getTime())
                .map((log) => (
                  <div key={log.id} className="relative">
                    <div className="absolute -left-[1.625rem] top-1 w-3 h-3 bg-blue-600 rounded-full border-2 border-white shadow-sm" />
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatDate(log.created_at ?? log.date)}
                        </span>
                        {log.milestone_stage && (
                          <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
                            {log.milestone_stage}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">By {log.user_name ?? 'System'}</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{log.remarks}</p>
                    </div>
                  </div>
                ))}
              {project.logs.filter((l) => !selectedLogSection || l.milestone_stage === selectedLogSection).length === 0 && (
                <p className="text-sm text-gray-400 italic">No updates logged yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right — Milestones */}
        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListChecks size={16} className="text-emerald-600" aria-hidden="true" />
              <h2 className="font-bold text-gray-900">Project Milestones</h2>
            </div>
            {hasPending && (
              <button onClick={handleSaveTasks} className="btn bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500 text-xs py-1.5 animate-pulse">
                <Save size={13} /> Save ({Object.keys(pendingTasks).length})
              </button>
            )}
          </div>

          <div className="max-h-[calc(100vh-320px)] overflow-y-auto divide-y divide-gray-100">
            {Object.keys(sections).map((sectionName) => {
              const sectionTasks = sections[sectionName];
              const isExpanded = expandedSections.includes(sectionName);
              const activeTasks = sectionTasks.filter((t) => t.is_active);
              const allDone = activeTasks.length > 0 && activeTasks.every((t) => t.is_completed);

              return (
                <div key={sectionName}>
                  {/* Section header */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-l-4 border-blue-600">
                    <button
                      onClick={() => setExpandedSections((prev) =>
                        prev.includes(sectionName) ? prev.filter((s) => s !== sectionName) : [...prev, sectionName]
                      )}
                      className="flex items-center gap-2 flex-1 text-left"
                      aria-expanded={isExpanded}
                    >
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">{sectionName}</span>
                      {isExpanded ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedLogSection(selectedLogSection === sectionName ? null : sectionName)}
                        className={`p-1 rounded transition-colors ${selectedLogSection === sectionName ? 'text-emerald-700 bg-emerald-50' : 'text-gray-400 hover:text-gray-600'}`}
                        aria-label={`Filter logs by ${sectionName}`}
                        title="Filter logs by section"
                      >
                        <Filter size={14} />
                      </button>
                      <button
                        onClick={() => toggleSectionCompletion(sectionName, sectionTasks)}
                        className="p-1 rounded text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label={`Toggle all tasks in ${sectionName}`}
                        title="Toggle all in section"
                      >
                        {allDone ? <CheckSquare size={16} className="text-emerald-600" /> : <Square size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Tasks */}
                  {isExpanded && (
                    <div className="p-2 space-y-1">
                      {sectionTasks.map((task) => (
                        <button
                          key={task.id}
                          onClick={() => handleToggleTask(task.id, task.is_completed, task.is_active)}
                          disabled={!task.is_active}
                          className={`w-full flex items-start gap-3 p-2.5 rounded-lg border text-left transition-all ${
                            !task.is_active
                              ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                              : task.is_completed
                              ? 'bg-emerald-50 border-emerald-200 cursor-pointer hover:bg-emerald-100'
                              : 'bg-white border-transparent cursor-pointer hover:bg-gray-50 hover:border-gray-200'
                          }`}
                          aria-pressed={task.is_completed}
                          aria-label={`${task.is_completed ? 'Mark incomplete' : 'Mark complete'}: ${task.task_name}`}
                        >
                          <span className="mt-0.5 flex-shrink-0">
                            {!task.is_active
                              ? <X size={16} className="text-gray-400" />
                              : task.is_completed
                              ? <CheckCircle2 size={16} className="text-emerald-600" />
                              : <Circle size={16} className="text-gray-300" />
                            }
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-medium leading-snug ${
                                !task.is_active ? 'line-through text-gray-400' : task.is_completed ? 'text-emerald-800' : 'text-gray-800'
                              }`}>
                                {task.task_name}
                              </span>
                              {!task.is_active && (
                                <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded uppercase">Removed</span>
                              )}
                            </div>
                            <div className="flex justify-between mt-0.5">
                              <span className="text-[10px] text-gray-400">{task.is_active ? `${task.weight}%` : '0%'}</span>
                              {task.is_completed && task.completed_at && task.is_active && (
                                <span className="text-[10px] text-emerald-600">
                                  {new Date(task.completed_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Log Modal */}
      <Modal isOpen={isLogModalOpen} onClose={() => setIsLogModalOpen(false)} title="Add Daily Update"
        footer={
          <>
            <button onClick={() => setIsLogModalOpen(false)} className="btn-secondary">Cancel</button>
            <button form="log-form" type="submit" className="btn-dark">Save Log</button>
          </>
        }
      >
        <form id="log-form" onSubmit={handleAddLog} noValidate>
          <div className="form-group">
            <label htmlFor="log-remarks" className="label">
              Remarks / Activity <span className="text-red-500">*</span>
            </label>
            <textarea
              id="log-remarks"
              required
              rows={4}
              value={logRemarks}
              onChange={(e) => setLogRemarks(e.target.value)}
              className="input resize-none"
              placeholder="What work was completed today?"
            />
          </div>
        </form>
      </Modal>

      {/* Edit Project Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Project Details" maxWidth="max-w-2xl"
        footer={
          <>
            <button onClick={() => setIsEditModalOpen(false)} className="btn-secondary">Cancel</button>
            <button form="edit-project-form" type="submit" className="btn-primary">Update Project</button>
          </>
        }
      >
        <form id="edit-project-form" onSubmit={handleUpdateProject} noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="ep-poc1" className="label">POC 1</label>
              <input id="ep-poc1" type="text" value={editForm.poc_1}
                onChange={(e) => setEditForm({ ...editForm, poc_1: e.target.value })} className="input" />
            </div>
            <div className="form-group">
              <label htmlFor="ep-poc2" className="label">POC 2</label>
              <input id="ep-poc2" type="text" value={editForm.poc_2}
                onChange={(e) => setEditForm({ ...editForm, poc_2: e.target.value })} className="input" />
            </div>
            {currentUser?.role !== 'ENGINEER' && (
              <div className="form-group col-span-2">
                <label htmlFor="ep-engineer" className="label">Assign Engineer</label>
                <select id="ep-engineer" value={editForm.assigned_user_id}
                  onChange={(e) => setEditForm({ ...editForm, assigned_user_id: e.target.value })}
                  className="input">
                  <option value="">— Unassigned —</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="ep-uat" className="label">UAT Version</label>
              <input id="ep-uat" type="text" value={editForm.uat_version}
                onChange={(e) => setEditForm({ ...editForm, uat_version: e.target.value })} className="input" />
            </div>
            <div className="form-group">
              <label htmlFor="ep-status" className="label">Status</label>
              <select id="ep-status" value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value as ImplementationStatus })}
                className="input">
                <option value="InProgress">In Progress</option>
                <option value="OnHold">On Hold</option>
                <option value="Blocked">Blocked</option>
                <option value="Live">Live</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="ep-po" className="label">PO Date</label>
              <input id="ep-po" type="date" value={editForm.po_date}
                onChange={(e) => setEditForm({ ...editForm, po_date: e.target.value })} className="input" />
            </div>
            <div className="form-group">
              <label htmlFor="ep-start" className="label">Start Date</label>
              <input id="ep-start" type="date" value={editForm.start_date}
                onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} className="input" />
            </div>
            <div className="form-group">
              <label htmlFor="ep-end" className="label">Expected End</label>
              <input id="ep-end" type="date" value={editForm.expected_end_date}
                onChange={(e) => setEditForm({ ...editForm, expected_end_date: e.target.value })} className="input" />
            </div>
            {(editForm.status === 'Blocked' || editForm.status === 'OnHold') && (
              <div className="form-group col-span-2">
                <label htmlFor="ep-remarks" className="label">
                  Status Remarks <span className="text-red-500">*</span>
                </label>
                <textarea id="ep-remarks" required rows={3} value={editForm.status_remarks}
                  onChange={(e) => setEditForm({ ...editForm, status_remarks: e.target.value })}
                  className="input resize-none"
                  placeholder={`Reason for ${editForm.status} status…`}
                />
              </div>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ImplementationDetail;
