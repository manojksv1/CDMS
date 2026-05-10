import React, { useEffect, useState, useMemo, useCallback } from 'react';
import api from '../api';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import {
  Plus, X, ChevronDown, ChevronRight, Edit2, Download,
  MessageSquare, Send, Reply, Trash, Info, Search,
} from 'lucide-react';
import Modal from '../components/Modal';
import { TableSkeleton } from '../components/Skeleton';
import type { Client, Location, Task, User, Comment, TaskStatus } from '../types/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ClientFormData {
  name: string; database_type: string; database_version: string;
  remarks: string; tags: string; location_name: string; existing_client_id: string;
}

interface EditTaskFormData {
  status: TaskStatus; assigned_to: string; build_version: string; remarks: string;
}

interface CreateTaskFormData {
  name: string; due_date: string; build_version: string;
  remarks: string; assigned_to: string; client_id: number; location_id: string;
}

const EMPTY_CLIENT_FORM: ClientFormData = {
  name: '', database_type: 'MS SQL', database_version: '',
  remarks: '', tags: '', location_name: '', existing_client_id: '',
};

const STATUS_BADGE: Record<TaskStatus, string> = {
  COMPLETED: 'badge-green', IN_PROGRESS: 'badge-blue',
  BLOCKED: 'badge-red', NOT_STARTED: 'badge-gray',
};

const esc = (v: unknown): string => {
  if (v == null) return '""';
  return `"${String(v).replace(/"/g, '""').replace(/\n/g, ' ')}"`;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentUser = useAuthStore((s) => s.user);
  const showNotification = useNotificationStore((s) => s.show);

  const [expandedClient, setExpandedClient] = useState<number | null>(null);
  const [expandedLocation, setExpandedLocation] = useState<number | null>(null);

  // Modal states
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isEditClientModalOpen, setIsEditClientModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isEditTaskModalOpen, setIsEditTaskModalOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCommentsModalOpen, setIsCommentsModalOpen] = useState(false);

  const [exportClientId, setExportClientId] = useState<number | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Comments
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showSearchInfo, setShowSearchInfo] = useState(false);
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);

  // Forms
  const [clientCreationMode, setClientCreationMode] = useState<'new' | 'existing'>('new');
  const [clientFormData, setClientFormData] = useState<ClientFormData>(EMPTY_CLIENT_FORM);
  const [editTaskFormData, setEditTaskFormData] = useState<EditTaskFormData>({
    status: 'NOT_STARTED', assigned_to: '', build_version: '', remarks: '',
  });
  const [createTaskFormData, setCreateTaskFormData] = useState<CreateTaskFormData>({
    name: '', due_date: '', build_version: '', remarks: '', assigned_to: '', client_id: 0, location_id: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [exportOptions, setExportOptions] = useState({
    clientName: true, clientLocation: true, databaseType: true, databaseVersion: true,
    clientTags: true, clientRemarks: true, trackingLocation: true, taskName: true,
    taskBuildVersion: true, taskDueDate: true, taskPOC: true, taskStatus: true, taskRemarks: true,
  });

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [clientRes, locRes, taskRes, userRes] = await Promise.all([
        api.get<Client[]>('/clients/?limit=500'),
        api.get<Location[]>('/locations/?limit=500'),
        api.get<Task[]>('/tasks/?limit=500'),
        api.get<User[]>('/users/?limit=100'),
      ]);
      setClients(clientRes.data);
      setLocations(locRes.data);
      setTasks(taskRes.data);
      setUsers(userRes.data);
    } catch { /* handled by interceptor */ } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchComments = useCallback(async (taskId: number) => {
    try {
      const res = await api.get<Comment[]>(`/comments/task/${taskId}`);
      setComments(res.data);
    } catch { /* handled */ }
  }, []);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------
  const getClientTasks = useCallback((clientId: number): Task[] => {
    const locIds = new Set(locations.filter((l) => l.client_id === clientId).map((l) => l.id));
    return tasks.filter((t) => locIds.has(t.location_id));
  }, [locations, tasks]);

  const filteredClients = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    const sorted = [...clients].sort((a, b) => {
      const aTasks = getClientTasks(a.id);
      const bTasks = getClientTasks(b.id);
      const aPct = aTasks.length > 0 ? aTasks.filter((t) => t.status === 'COMPLETED').length / aTasks.length : 0;
      const bPct = bTasks.length > 0 ? bTasks.filter((t) => t.status === 'COMPLETED').length / bTasks.length : 0;
      if (aPct !== bPct) return bPct - aPct;
      return a.name.localeCompare(b.name);
    });

    if (!q) return sorted;

    if (q.includes('=')) {
      const [key, ...rest] = q.split('=');
      const val = rest.join('=').trim();
      return sorted.filter((c) => {
        switch (key.trim()) {
          case 'tag': return c.tags?.toLowerCase().includes(val) ?? false;
          case 'db': return (c.database_type?.toLowerCase().includes(val) ?? false) || (c.database_version?.toLowerCase().includes(val) ?? false);
          case 'name': return c.name.toLowerCase().includes(val);
          default: return true;
        }
      });
    }

    return sorted.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.database_type?.toLowerCase().includes(q) ?? false) ||
      (c.database_version?.toLowerCase().includes(q) ?? false) ||
      (c.remarks?.toLowerCase().includes(q) ?? false) ||
      (c.tags?.toLowerCase().includes(q) ?? false),
    );
  }, [clients, debouncedSearch, getClientTasks]);

  const getUserName = (id: number): string => users.find((u) => u.id === id)?.name ?? String(id);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (clientCreationMode === 'new') {
        const { location_name, existing_client_id: _eid, ...clientData } = clientFormData;
        const newClient = await api.post<Client>('/clients/', clientData);
        await api.post('/locations/', { name: location_name || 'Main Office', client_id: newClient.data.id, hostname: '' });
        showNotification('Client and location created!', 'success');
      } else {
        if (!clientFormData.existing_client_id) { showNotification('Please select a client', 'error'); return; }
        await api.post('/locations/', { name: clientFormData.location_name || 'Branch Office', client_id: parseInt(clientFormData.existing_client_id), hostname: '' });
        showNotification('Location added to client!', 'success');
      }
      setIsClientModalOpen(false);
      setClientFormData(EMPTY_CLIENT_FORM);
      fetchData();
    } catch { /* handled */ } finally { setIsSubmitting(false); }
  };

  const openEditClient = (client: Client) => {
    setSelectedClient(client);
    const defaultLoc = locations.find((l) => l.client_id === client.id);
    setClientFormData({
      name: client.name, database_type: client.database_type ?? 'MS SQL',
      database_version: client.database_version ?? '', remarks: client.remarks ?? '',
      tags: client.tags ?? '', location_name: defaultLoc?.name ?? '',
      existing_client_id: defaultLoc?.id.toString() ?? '',
    });
    setIsEditClientModalOpen(true);
  };

  const handleEditClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    setIsSubmitting(true);
    try {
      const { location_name, existing_client_id: locationId, ...clientData } = clientFormData;
      await api.patch(`/clients/${selectedClient.id}`, clientData);
      if (locationId && location_name) {
        await api.patch(`/locations/${locationId}`, { name: location_name });
      } else if (!locationId && location_name) {
        await api.post('/locations/', { name: location_name, client_id: selectedClient.id, hostname: '' });
      }
      setIsEditClientModalOpen(false);
      setClientFormData(EMPTY_CLIENT_FORM);
      showNotification('Client updated!', 'success');
      fetchData();
    } catch { /* handled */ } finally { setIsSubmitting(false); }
  };

  const openCreateTask = (clientId: number, locationId?: string) => {
    setCreateTaskFormData({ name: '', due_date: '', build_version: '', remarks: '', assigned_to: '', client_id: clientId, location_id: locationId ?? '' });
    setIsCreateTaskModalOpen(true);
  };

  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let locationId = createTaskFormData.location_id ? parseInt(createTaskFormData.location_id) : 0;
      if (!locationId) {
        const existing = locations.find((l) => l.client_id === createTaskFormData.client_id);
        if (existing) { locationId = existing.id; }
        else {
          const newLoc = await api.post<Location>('/locations/', { name: 'Main Office', client_id: createTaskFormData.client_id, hostname: '' });
          locationId = newLoc.data.id;
        }
      }
      const newTask = await api.post<Task>('/tasks/', {
        name: createTaskFormData.name, due_date: createTaskFormData.due_date,
        build_version: createTaskFormData.build_version || null,
        remarks: createTaskFormData.remarks || null, location_id: locationId,
      });
      if (createTaskFormData.assigned_to) {
        await api.patch(`/tasks/${newTask.data.id}/assign`, { assigned_to: parseInt(createTaskFormData.assigned_to) });
      }
      setIsCreateTaskModalOpen(false);
      showNotification('Task created!', 'success');
      fetchData();
    } catch { /* handled */ } finally { setIsSubmitting(false); }
  };

  const openTaskEdit = (task: Task) => {
    setSelectedTask(task);
    setEditTaskFormData({
      status: task.status, assigned_to: task.assigned_to?.toString() ?? '',
      build_version: task.build_version ?? '', remarks: task.remarks ?? '',
    });
    setIsEditTaskModalOpen(true);
  };

  const handleEditTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    setIsSubmitting(true);
    try {
      if (editTaskFormData.build_version !== (selectedTask.build_version ?? '') || editTaskFormData.remarks !== (selectedTask.remarks ?? '')) {
        await api.patch(`/tasks/${selectedTask.id}`, { build_version: editTaskFormData.build_version || null, remarks: editTaskFormData.remarks || null });
      }
      if (editTaskFormData.status !== selectedTask.status) {
        await api.patch(`/tasks/${selectedTask.id}/status`, { status: editTaskFormData.status });
      }
      if (editTaskFormData.assigned_to !== (selectedTask.assigned_to?.toString() ?? '') && currentUser?.role !== 'ENGINEER') {
        await api.patch(`/tasks/${selectedTask.id}/assign`, { assigned_to: editTaskFormData.assigned_to ? parseInt(editTaskFormData.assigned_to) : null });
      }
      setIsEditTaskModalOpen(false);
      showNotification('Task updated!', 'success');
      fetchData();
    } catch { /* handled */ } finally { setIsSubmitting(false); }
  };

  const openComments = (task: Task) => {
    setSelectedTask(task);
    fetchComments(task.id);
    setIsCommentsModalOpen(true);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedTask) return;
    try {
      await api.post('/comments/', { task_id: selectedTask.id, content: newComment, parent_id: replyTo });
      setNewComment(''); setReplyTo(null);
      showNotification('Comment added!', 'success');
      fetchComments(selectedTask.id);
    } catch { /* handled */ }
  };

  const handleDeleteComment = async (id: number) => {
    if (!selectedTask) return;
    if (!window.confirm('Delete this comment?')) return;
    try {
      await api.delete(`/comments/${id}`);
      showNotification('Comment deleted', 'info');
      fetchComments(selectedTask.id);
    } catch { /* handled */ }
  };

  const handleExportCSV = () => {
    const headers: string[] = [];
    if (exportOptions.clientName) headers.push('Client Name');
    if (exportOptions.clientLocation) headers.push('Client City');
    if (exportOptions.databaseType) headers.push('Database Type');
    if (exportOptions.databaseVersion) headers.push('Database Version');
    if (exportOptions.clientTags) headers.push('Tags');
    if (exportOptions.clientRemarks) headers.push('Client Remarks');
    if (exportOptions.trackingLocation) headers.push('Tracking Location');
    if (exportOptions.taskName) headers.push('Tracking Phase');
    if (exportOptions.taskBuildVersion) headers.push('Build Version');
    if (exportOptions.taskDueDate) headers.push('Due Date');
    if (exportOptions.taskPOC) headers.push('Point of Contact');
    if (exportOptions.taskStatus) headers.push('Status');
    if (exportOptions.taskRemarks) headers.push('Task Remarks');

    const rows: string[] = [headers.join(',')];
    const clientsToExport = exportClientId ? clients.filter((c) => c.id === exportClientId) : filteredClients;

    clientsToExport.forEach((c) => {
      const clientTasks = getClientTasks(c.id);
      const baseRow = () => {
        const r: string[] = [];
        if (exportOptions.clientName) r.push(esc(c.name));
        if (exportOptions.clientLocation) r.push(esc(null));
        if (exportOptions.databaseType) r.push(esc(c.database_type));
        if (exportOptions.databaseVersion) r.push(esc(c.database_version));
        if (exportOptions.clientTags) r.push(esc(c.tags));
        if (exportOptions.clientRemarks) r.push(esc(c.remarks));
        return r;
      };
      if (clientTasks.length === 0) {
        const r = baseRow();
        if (exportOptions.trackingLocation) r.push('""');
        if (exportOptions.taskName) r.push('""');
        if (exportOptions.taskBuildVersion) r.push('""');
        if (exportOptions.taskDueDate) r.push('""');
        if (exportOptions.taskPOC) r.push('""');
        if (exportOptions.taskStatus) r.push('""');
        if (exportOptions.taskRemarks) r.push('""');
        rows.push(r.join(','));
      } else {
        clientTasks.forEach((t) => {
          const r = baseRow();
          if (exportOptions.trackingLocation) {
            const loc = locations.find((l) => l.id === t.location_id);
            r.push(esc(loc ? `${loc.name}${loc.hostname ? ` (${loc.hostname})` : ''}` : ''));
          }
          if (exportOptions.taskName) r.push(esc(t.name));
          if (exportOptions.taskBuildVersion) r.push(esc(t.build_version));
          if (exportOptions.taskDueDate) r.push(esc(t.due_date));
          if (exportOptions.taskPOC) r.push(esc(t.assigned_to ? getUserName(t.assigned_to) : 'Unassigned'));
          if (exportOptions.taskStatus) r.push(esc(t.status));
          if (exportOptions.taskRemarks) r.push(esc(t.remarks));
          rows.push(r.join(','));
        });
      }
    });

    const blob = new Blob(['\ufeff', rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportClientId ? `cdms_client_${exportClientId}.csv` : 'cdms_full_export.csv';
    a.click();
    URL.revokeObjectURL(url);
    setIsExportModalOpen(false);
    showNotification('CSV exported!', 'success');
  };

  // ---------------------------------------------------------------------------
  // Sub-components
  // ---------------------------------------------------------------------------
  const TasksTable = ({ locTasks }: { locTasks: Task[] }) => (
    <div className="overflow-x-auto">
      <table className="table text-xs">
        <thead>
          <tr>
            <th scope="col">Tracking Phase</th>
            <th scope="col">Build Version</th>
            <th scope="col">Due Date</th>
            <th scope="col">Point of Contact</th>
            <th scope="col">Status</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {locTasks.map((t) => (
            <tr key={t.id}>
              <td className="font-medium text-gray-900">{t.name}</td>
              <td>
                {t.build_version
                  ? <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">{t.build_version}</code>
                  : <span className="text-gray-400">—</span>}
              </td>
              <td className="text-gray-500">{t.due_date}</td>
              <td className="text-gray-500">
                {t.assigned_to ? getUserName(t.assigned_to) : <span className="italic text-gray-400">Unassigned</span>}
              </td>
              <td><span className={STATUS_BADGE[t.status]}>{t.status.replace('_', ' ')}</span></td>
              <td>
                <div className="flex items-center gap-2">
                  <button onClick={() => openComments(t)} className="btn-ghost text-gray-500 hover:text-blue-600" aria-label={`Comments for ${t.name}`} title="View discussion">
                    <MessageSquare size={14} />
                  </button>
                  <button onClick={() => openTaskEdit(t)} className="btn-ghost text-blue-600 hover:bg-blue-50" aria-label={`Edit task ${t.name}`}>
                    <Edit2 size={14} /> Edit
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div>
      {/* Header */}
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Installation Tracker</h1>
          <p className="page-subtitle">Manage clients, locations, and tracking phases</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search clients…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9 pr-9 w-64"
              aria-label="Search clients"
            />
            <button
              type="button"
              onMouseEnter={() => setShowSearchInfo(true)}
              onMouseLeave={() => setShowSearchInfo(false)}
              onFocus={() => setShowSearchInfo(true)}
              onBlur={() => setShowSearchInfo(false)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Search filter help"
            >
              <Info size={14} />
            </button>
            {showSearchInfo && (
              <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-4 z-50 text-sm text-gray-700">
                <p className="font-semibold text-gray-900 mb-2">Advanced Search Filters</p>
                <ul className="space-y-1.5 text-xs list-disc ml-4">
                  <li><strong>tag=xyz</strong> — search by tag (e.g. tag=vip)</li>
                  <li><strong>db=xyz</strong> — search by DB type/version</li>
                  <li><strong>name=xyz</strong> — search strictly by name</li>
                </ul>
              </div>
            )}
          </div>
          <button onClick={() => { setExportClientId(null); setIsExportModalOpen(true); }} className="btn-secondary">
            <Download size={15} /> Export
          </button>
          {currentUser?.role !== 'ENGINEER' && (
            <button onClick={() => { setClientCreationMode('new'); setClientFormData(EMPTY_CLIENT_FORM); setIsClientModalOpen(true); }} className="btn-primary">
              <Plus size={15} /> Add Client
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={8} />
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th scope="col" className="w-10"></th>
                <th scope="col" className="w-12">S.No</th>
                <th scope="col">Client Name</th>
                <th scope="col">Database</th>
                <th scope="col">Tags</th>
                <th scope="col">Remarks</th>
                <th scope="col">Tasks Status</th>
                <th scope="col" className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((c, index) => {
                const clientTasks = getClientTasks(c.id);
                const isExpanded = expandedClient === c.id;
                const completedCount = clientTasks.filter((t) => t.status === 'COMPLETED').length;
                const allDone = clientTasks.length > 0 && completedCount === clientTasks.length;

                return (
                  <React.Fragment key={c.id}>
                    <tr className={isExpanded ? 'bg-gray-50' : ''}>
                      <td className="text-center">
                        <button
                          onClick={() => setExpandedClient(isExpanded ? null : c.id)}
                          className="btn-ghost p-1"
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? `Collapse ${c.name}` : `Expand ${c.name}`}
                        >
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>
                      </td>
                      <td className="text-gray-400 font-medium">{index + 1}</td>
                      <td
                        className="font-semibold text-gray-900 cursor-pointer hover:text-blue-700"
                        onClick={() => setExpandedClient(isExpanded ? null : c.id)}
                        title="Click to view tracking phases"
                      >
                        {c.name}
                      </td>
                      <td>
                        {c.database_type ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded font-medium">{c.database_type}</span>
                            {c.database_version && <span className="text-xs text-gray-400">v{c.database_version}</span>}
                          </div>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td>
                        {c.tags ? (
                          <div className="flex flex-wrap gap-1">
                            {c.tags.split(',').map((tag, i) => (
                              <span key={i} className="badge-green text-xs">{tag.trim()}</span>
                            ))}
                          </div>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="max-w-xs truncate text-gray-500" title={c.remarks ?? ''}>
                        {c.remarks ?? '—'}
                      </td>
                      <td>
                        {clientTasks.length > 0 ? (
                          <span className={`font-semibold text-sm ${allDone ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {completedCount} / {clientTasks.length} Completed
                          </span>
                        ) : <span className="text-gray-400 text-sm">No Tasks</span>}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => { setSelectedClient(c); setIsInfoModalOpen(true); }} className="btn-ghost" aria-label={`View details for ${c.name}`} title="View details">
                            <Info size={15} />
                          </button>
                          {currentUser?.role !== 'ENGINEER' && (
                            <button onClick={() => openEditClient(c)} className="btn-ghost text-blue-600 hover:bg-blue-50" aria-label={`Edit ${c.name}`} title="Edit client">
                              <Edit2 size={15} />
                            </button>
                          )}
                          <button onClick={() => { setExportClientId(c.id); setIsExportModalOpen(true); }} className="btn-ghost" aria-label={`Export ${c.name}`} title="Export client data">
                            <Download size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded row */}
                    {isExpanded && (
                      <tr className="bg-gray-50/50">
                        <td colSpan={8} className="px-6 py-4">
                          {(() => {
                            const clientLocs = locations.filter((l) => l.client_id === c.id);
                            const isSingle = clientLocs.length === 1;

                            return (
                              <>
                                <div className="flex items-center justify-between mb-3">
                                  <h3 className="font-semibold text-gray-900 text-sm">
                                    {isSingle ? 'Tracking Phases' : 'Locations & Tracking Phases'}
                                  </h3>
                                  {isSingle && currentUser?.role !== 'ENGINEER' && (
                                    <button onClick={() => openCreateTask(c.id, clientLocs[0].id.toString())} className="btn-secondary text-xs py-1">
                                      <Plus size={13} /> Add Phase
                                    </button>
                                  )}
                                </div>

                                {isSingle ? (
                                  <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                                    {(() => {
                                      const locTasks = tasks.filter((t) => t.location_id === clientLocs[0].id);
                                      return locTasks.length > 0
                                        ? <TasksTable locTasks={locTasks} />
                                        : <p className="text-center text-gray-400 text-sm py-4">No tracking phases added yet.</p>;
                                    })()}
                                  </div>
                                ) : clientLocs.length > 0 ? (
                                  <div className="space-y-2">
                                    {clientLocs.map((loc) => {
                                      const locTasks = tasks.filter((t) => t.location_id === loc.id);
                                      const isLocExpanded = expandedLocation === loc.id;
                                      return (
                                        <div key={loc.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                                          <div
                                            className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-gray-50"
                                            onClick={() => setExpandedLocation(isLocExpanded ? null : loc.id)}
                                          >
                                            <div className="flex items-center gap-2">
                                              {isLocExpanded ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
                                              <span className="font-semibold text-sm text-gray-900">{loc.name}{loc.hostname ? ` (${loc.hostname})` : ''}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                              <span className="text-xs text-gray-400">{locTasks.length} phase{locTasks.length !== 1 ? 's' : ''}</span>
                                              {currentUser?.role !== 'ENGINEER' && (
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); openCreateTask(c.id, loc.id.toString()); }}
                                                  className="btn-secondary text-xs py-0.5 px-2"
                                                  aria-label={`Add phase to ${loc.name}`}
                                                >
                                                  <Plus size={12} /> Add Phase
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                          {isLocExpanded && (
                                            <div className="border-t border-gray-100">
                                              {locTasks.length > 0
                                                ? <TasksTable locTasks={locTasks} />
                                                : <p className="text-center text-gray-400 text-sm py-4">No tracking phases for this location.</p>}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-center text-gray-400 text-sm py-4">No locations or tasks added yet.</p>
                                )}
                              </>
                            );
                          })()}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filteredClients.length === 0 && (
                <tr><td colSpan={8} className="text-center text-gray-400 py-10">No clients found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ---- MODALS ---- */}

      {/* Add Client Modal */}
      <Modal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} title="Add Client / Location" maxWidth="max-w-lg"
        footer={
          <>
            <button onClick={() => setIsClientModalOpen(false)} className="btn-secondary">Cancel</button>
            <button form="add-client-form" type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-200 mb-5 -mt-2">
          {(['new', 'existing'] as const).map((mode) => (
            <button key={mode} type="button" onClick={() => setClientCreationMode(mode)}
              className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${clientCreationMode === mode ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {mode === 'new' ? 'Create New Company' : 'Add Location to Existing'}
            </button>
          ))}
        </div>
        <form id="add-client-form" onSubmit={handleClientSubmit} noValidate>
          {clientCreationMode === 'new' ? (
            <div className="space-y-4">
              <div className="form-group">
                <label htmlFor="ac-name" className="label">Client Name <span className="text-red-500">*</span></label>
                <input id="ac-name" required type="text" value={clientFormData.name} onChange={(e) => setClientFormData({ ...clientFormData, name: e.target.value })} className="input" />
              </div>
              <div className="form-group">
                <label htmlFor="ac-loc" className="label">Default Location Name <span className="text-red-500">*</span></label>
                <input id="ac-loc" required type="text" placeholder="e.g. Main Office, HQ" value={clientFormData.location_name} onChange={(e) => setClientFormData({ ...clientFormData, location_name: e.target.value })} className="input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label htmlFor="ac-dbtype" className="label">Database Type</label>
                  <select id="ac-dbtype" value={clientFormData.database_type} onChange={(e) => setClientFormData({ ...clientFormData, database_type: e.target.value })} className="input">
                    <option value="">— None —</option>
                    <option value="MS SQL">MS SQL</option>
                    <option value="MySQL">MySQL</option>
                    <option value="Oracle">Oracle</option>
                    <option value="PostgreSQL">PostgreSQL</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="ac-dbver" className="label">DB Version</label>
                  <input id="ac-dbver" type="text" placeholder="e.g. 2019" value={clientFormData.database_version} onChange={(e) => setClientFormData({ ...clientFormData, database_version: e.target.value })} className="input" />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="ac-tags" className="label">Tags</label>
                <input id="ac-tags" type="text" placeholder="e.g. Urgent, VIP" value={clientFormData.tags} onChange={(e) => setClientFormData({ ...clientFormData, tags: e.target.value })} className="input" />
              </div>
              <div className="form-group">
                <label htmlFor="ac-remarks" className="label">Remarks</label>
                <textarea id="ac-remarks" rows={3} value={clientFormData.remarks} onChange={(e) => setClientFormData({ ...clientFormData, remarks: e.target.value })} className="input resize-none" />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="form-group">
                <label htmlFor="ac-existing" className="label">Select Company <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input id="ac-existing" type="text" placeholder="Search and select company…"
                    value={companySearchQuery}
                    onChange={(e) => { setCompanySearchQuery(e.target.value); setClientFormData({ ...clientFormData, existing_client_id: '' }); setIsCompanyDropdownOpen(true); }}
                    onFocus={() => setIsCompanyDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setIsCompanyDropdownOpen(false), 200)}
                    className="input" autoComplete="off" />
                  {isCompanyDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
                      {clients.filter((c) => c.name.toLowerCase().includes(companySearchQuery.toLowerCase())).length > 0
                        ? clients.filter((c) => c.name.toLowerCase().includes(companySearchQuery.toLowerCase())).map((c) => (
                          <button key={c.id} type="button"
                            onClick={() => { setClientFormData({ ...clientFormData, existing_client_id: c.id.toString() }); setCompanySearchQuery(c.name); setIsCompanyDropdownOpen(false); }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0">
                            {c.name}
                          </button>
                        ))
                        : <p className="px-4 py-2 text-sm text-gray-400">No companies found</p>}
                    </div>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="ac-newloc" className="label">New Location Name <span className="text-red-500">*</span></label>
                <input id="ac-newloc" required type="text" placeholder="e.g. Branch Office" value={clientFormData.location_name} onChange={(e) => setClientFormData({ ...clientFormData, location_name: e.target.value })} className="input" />
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Edit Client Modal */}
      <Modal isOpen={isEditClientModalOpen} onClose={() => setIsEditClientModalOpen(false)} title={`Edit Client: ${selectedClient?.name ?? ''}`} maxWidth="max-w-lg"
        footer={
          <>
            <button onClick={() => setIsEditClientModalOpen(false)} className="btn-secondary">Cancel</button>
            <button form="edit-client-form" type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Updating…' : 'Update Client'}
            </button>
          </>
        }
      >
        <form id="edit-client-form" onSubmit={handleEditClientSubmit} noValidate>
          <div className="space-y-4">
            <div className="form-group">
              <label htmlFor="ec-name" className="label">Client Name <span className="text-red-500">*</span></label>
              <input id="ec-name" required type="text" value={clientFormData.name} onChange={(e) => setClientFormData({ ...clientFormData, name: e.target.value })} className="input" />
            </div>
            <div className="form-group">
              <label htmlFor="ec-loc" className="label">Default Location Name</label>
              <input id="ec-loc" type="text" value={clientFormData.location_name} onChange={(e) => setClientFormData({ ...clientFormData, location_name: e.target.value })} className="input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label htmlFor="ec-dbtype" className="label">Database Type</label>
                <select id="ec-dbtype" value={clientFormData.database_type} onChange={(e) => setClientFormData({ ...clientFormData, database_type: e.target.value })} className="input">
                  <option value="">— None —</option>
                  <option value="MS SQL">MS SQL</option>
                  <option value="MySQL">MySQL</option>
                  <option value="Oracle">Oracle</option>
                  <option value="PostgreSQL">PostgreSQL</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="ec-dbver" className="label">DB Version</label>
                <input id="ec-dbver" type="text" value={clientFormData.database_version} onChange={(e) => setClientFormData({ ...clientFormData, database_version: e.target.value })} className="input" />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="ec-tags" className="label">Tags</label>
              <input id="ec-tags" type="text" value={clientFormData.tags} onChange={(e) => setClientFormData({ ...clientFormData, tags: e.target.value })} className="input" />
            </div>
            <div className="form-group">
              <label htmlFor="ec-remarks" className="label">Remarks</label>
              <textarea id="ec-remarks" rows={3} value={clientFormData.remarks} onChange={(e) => setClientFormData({ ...clientFormData, remarks: e.target.value })} className="input resize-none" />
            </div>
          </div>
        </form>
      </Modal>

      {/* Client Info Modal */}
      <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} title={`Client Details: ${selectedClient?.name ?? ''}`} maxWidth="max-w-lg"
        footer={<button onClick={() => setIsInfoModalOpen(false)} className="btn-dark">Close</button>}
      >
        {selectedClient && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="label">Database Type</p><p className="text-gray-700">{selectedClient.database_type ?? '—'}</p></div>
              <div><p className="label">DB Version</p><p className="text-gray-700">{selectedClient.database_version ?? '—'}</p></div>
              <div><p className="label">Tags</p><p className="text-gray-700">{selectedClient.tags ?? '—'}</p></div>
            </div>
            <div>
              <p className="label">Remarks</p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 min-h-[60px]">
                {selectedClient.remarks ?? 'No remarks provided.'}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Task Modal */}
      <Modal isOpen={isCreateTaskModalOpen} onClose={() => setIsCreateTaskModalOpen(false)} title="Add Tracking Phase"
        footer={
          <>
            <button onClick={() => setIsCreateTaskModalOpen(false)} className="btn-secondary">Cancel</button>
            <button form="create-task-form" type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Saving…' : 'Create Phase'}
            </button>
          </>
        }
      >
        <form id="create-task-form" onSubmit={handleCreateTaskSubmit} noValidate>
          <div className="space-y-4">
            <div className="form-group">
              <label htmlFor="ct-loc" className="label">Location</label>
              <select id="ct-loc" value={createTaskFormData.location_id} onChange={(e) => setCreateTaskFormData({ ...createTaskFormData, location_id: e.target.value })} className="input">
                <option value="">— Select Location —</option>
                {locations.filter((l) => l.client_id === createTaskFormData.client_id).map((l) => (
                  <option key={l.id} value={l.id}>{l.name}{l.hostname ? ` (${l.hostname})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="ct-name" className="label">Phase Name <span className="text-red-500">*</span></label>
              <input id="ct-name" required type="text" value={createTaskFormData.name} onChange={(e) => setCreateTaskFormData({ ...createTaskFormData, name: e.target.value })} className="input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label htmlFor="ct-due" className="label">Due Date <span className="text-red-500">*</span></label>
                <input id="ct-due" required type="date" value={createTaskFormData.due_date} onChange={(e) => setCreateTaskFormData({ ...createTaskFormData, due_date: e.target.value })} className="input" />
              </div>
              <div className="form-group">
                <label htmlFor="ct-build" className="label">Build Version</label>
                <input id="ct-build" type="text" value={createTaskFormData.build_version} onChange={(e) => setCreateTaskFormData({ ...createTaskFormData, build_version: e.target.value })} className="input" />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="ct-poc" className="label">Assign To</label>
              <select id="ct-poc" value={createTaskFormData.assigned_to} onChange={(e) => setCreateTaskFormData({ ...createTaskFormData, assigned_to: e.target.value })} className="input">
                <option value="">— Unassigned —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="ct-remarks" className="label">Remarks</label>
              <textarea id="ct-remarks" rows={2} value={createTaskFormData.remarks} onChange={(e) => setCreateTaskFormData({ ...createTaskFormData, remarks: e.target.value })} className="input resize-none" />
            </div>
          </div>
        </form>
      </Modal>

      {/* Edit Task Modal */}
      <Modal isOpen={isEditTaskModalOpen} onClose={() => setIsEditTaskModalOpen(false)} title={`Edit Phase: ${selectedTask?.name ?? ''}`}
        footer={
          <>
            <button onClick={() => setIsEditTaskModalOpen(false)} className="btn-secondary">Cancel</button>
            <button form="edit-task-form" type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Saving…' : 'Update Phase'}
            </button>
          </>
        }
      >
        <form id="edit-task-form" onSubmit={handleEditTaskSubmit} noValidate>
          <div className="space-y-4">
            <div className="form-group">
              <label htmlFor="et-status" className="label">Status</label>
              <select id="et-status" value={editTaskFormData.status} onChange={(e) => setEditTaskFormData({ ...editTaskFormData, status: e.target.value as TaskStatus })} className="input">
                <option value="NOT_STARTED">Not Started</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="BLOCKED">Blocked</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
            {currentUser?.role !== 'ENGINEER' && (
              <div className="form-group">
                <label htmlFor="et-poc" className="label">Assign To</label>
                <select id="et-poc" value={editTaskFormData.assigned_to} onChange={(e) => setEditTaskFormData({ ...editTaskFormData, assigned_to: e.target.value })} className="input">
                  <option value="">— Unassigned —</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="et-build" className="label">Build Version</label>
              <input id="et-build" type="text" value={editTaskFormData.build_version} onChange={(e) => setEditTaskFormData({ ...editTaskFormData, build_version: e.target.value })} className="input" />
            </div>
            <div className="form-group">
              <label htmlFor="et-remarks" className="label">Remarks</label>
              <textarea id="et-remarks" rows={2} value={editTaskFormData.remarks} onChange={(e) => setEditTaskFormData({ ...editTaskFormData, remarks: e.target.value })} className="input resize-none" />
            </div>
          </div>
        </form>
      </Modal>

      {/* Comments Modal */}
      <Modal isOpen={isCommentsModalOpen} onClose={() => { setIsCommentsModalOpen(false); setReplyTo(null); setNewComment(''); }} title={`Discussion: ${selectedTask?.name ?? ''}`} maxWidth="max-w-xl"
        footer={null}
      >
        <div className="space-y-4">
          {/* Comment list */}
          <div className="max-h-72 overflow-y-auto space-y-3 pr-1" role="log" aria-label="Comments">
            {comments.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-6">No comments yet. Be the first!</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-700">{comment.user?.name ?? 'Unknown'}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{new Date(comment.timestamp).toLocaleString()}</span>
                      <button onClick={() => setReplyTo(comment.id)} className="btn-ghost text-xs text-blue-600 py-0.5 px-1.5" aria-label={`Reply to ${comment.user?.name ?? 'comment'}`}>
                        <Reply size={12} /> Reply
                      </button>
                      <button onClick={() => handleDeleteComment(comment.id)} className="btn-ghost text-xs text-red-500 py-0.5 px-1.5" aria-label="Delete comment">
                        <Trash size={12} />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700">{comment.content}</p>
                  {/* Replies */}
                  {comment.replies?.length > 0 && (
                    <div className="mt-2 ml-4 space-y-2 border-l-2 border-gray-200 pl-3">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="bg-white rounded p-2 border border-gray-100">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-semibold text-gray-600">{reply.user?.name ?? 'Unknown'}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-400">{new Date(reply.timestamp).toLocaleString()}</span>
                              <button onClick={() => handleDeleteComment(reply.id)} className="btn-ghost text-xs text-red-500 py-0.5 px-1" aria-label="Delete reply">
                                <Trash size={11} />
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-gray-700">{reply.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Add comment form */}
          {replyTo && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-xs text-blue-700">
              <Reply size={12} /> Replying to comment #{replyTo}
              <button onClick={() => setReplyTo(null)} className="ml-auto text-blue-500 hover:text-blue-700" aria-label="Cancel reply"><X size={12} /></button>
            </div>
          )}
          <form onSubmit={handleAddComment} className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={replyTo ? 'Write a reply…' : 'Write a comment…'}
              className="input flex-1"
              aria-label="Comment input"
            />
            <button type="submit" disabled={!newComment.trim()} className="btn-primary px-3" aria-label="Post comment">
              <Send size={15} />
            </button>
          </form>
        </div>
      </Modal>

      {/* Export Modal */}
      <Modal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} title="Export Installation Data"
        footer={
          <>
            <button onClick={() => setIsExportModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleExportCSV} className="btn-dark"><Download size={15} /> Download CSV</button>
          </>
        }
      >
        <p className="text-sm text-gray-500 mb-4">Select columns to include in the export.</p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(exportOptions) as (keyof typeof exportOptions)[]).map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={exportOptions[key]} onChange={() => setExportOptions((p) => ({ ...p, [key]: !p[key] }))} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
            </label>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default Clients;
