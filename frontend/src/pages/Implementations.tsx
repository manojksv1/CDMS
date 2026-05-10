import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import {
  Plus, Search, ExternalLink, Calendar, User,
  CheckCircle2, Clock, AlertCircle, X, UserCheck, Download,
} from 'lucide-react';
import Modal from '../components/Modal';
import { TableSkeleton } from '../components/Skeleton';
import type { Implementation, ImplementationCreate, User as UserType, ImplementationStatus } from '../types/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const STATUS_STYLES: Record<ImplementationStatus, { badge: string; icon: React.ReactNode; label: string }> = {
  Live:        { badge: 'badge-green',  icon: <CheckCircle2 size={12} />, label: 'Live' },
  Completed:   { badge: 'badge-blue',   icon: <CheckCircle2 size={12} />, label: 'Completed' },
  Blocked:     { badge: 'badge-red',    icon: <X size={12} />,            label: 'Blocked' },
  OnHold:      { badge: 'badge-yellow', icon: <AlertCircle size={12} />,  label: 'On Hold' },
  InProgress:  { badge: 'badge-gray',   icon: <Clock size={12} />,        label: 'In Progress' },
};

const STATUS_FILTERS: ImplementationStatus[] = ['InProgress', 'Live', 'Completed', 'OnHold', 'Blocked'];

const EMPTY_FORM: ImplementationCreate & { assigned_user_id_str: string } = {
  company_name: '', zone: '', assigned_user_id: null, assigned_user_id_str: '',
  po_date: null, poc_1: null, poc_2: null, license_uat: null, license_prod: null,
  uat_version: null, prod_version: null, start_date: null, expected_end_date: null,
  status: 'InProgress', status_remarks: null,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const Implementations: React.FC = () => {
  const [implementations, setImplementations] = useState<Implementation[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | ImplementationStatus>('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [exportOptions, setExportOptions] = useState({
    companyName: true, engineer: true, status: true, targetDate: true,
    poc1: true, poc2: true, licenseUat: true, licenseProd: true,
    uatVersion: true, prodVersion: true, poDate: true, startDate: true, remarks: true,
  });

  const currentUser = useAuthStore((s) => s.user);
  const showNotification = useNotificationStore((s) => s.show);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const requests: Promise<{ data: unknown }>[] = [api.get<Implementation[]>('/implementations/')];
      if (currentUser?.role !== 'ENGINEER') {
        requests.push(api.get<UserType[]>('/users/'));
      }
      const [impRes, usersRes] = await Promise.all(requests);
      setImplementations((impRes as { data: Implementation[] }).data);
      if (usersRes) {
        setUsers(((usersRes as { data: UserType[] }).data).filter((u) => u.role === 'ENGINEER'));
      }
    } catch {
      // handled by interceptor
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.role]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredImplementations = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return implementations.filter((imp) => {
      const matchesSearch =
        !q ||
        imp.company_name.toLowerCase().includes(q) ||
        (imp.poc_1?.toLowerCase().includes(q) ?? false);
      const matchesStatus = statusFilter === 'All' || imp.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [implementations, searchQuery, statusFilter]);

  const handleAddImplementation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload: ImplementationCreate = {
        ...formData,
        assigned_user_id: formData.assigned_user_id_str
          ? parseInt(formData.assigned_user_id_str)
          : null,
        po_date: formData.po_date || null,
        start_date: formData.start_date || null,
        expected_end_date: formData.expected_end_date || null,
      };
      await api.post('/implementations/', payload);
      showNotification('Project created successfully!', 'success');
      setIsAddModalOpen(false);
      setFormData(EMPTY_FORM);
      fetchData();
    } catch {
      // handled by interceptor
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    const headers: string[] = [];
    if (exportOptions.companyName) headers.push('Company Name');
    if (exportOptions.engineer) headers.push('Engineer');
    if (exportOptions.status) headers.push('Status');
    if (exportOptions.targetDate) headers.push('Target Date');
    if (exportOptions.poc1) headers.push('POC 1');
    if (exportOptions.poc2) headers.push('POC 2');
    if (exportOptions.licenseUat) headers.push('License (UAT)');
    if (exportOptions.licenseProd) headers.push('License (Prod)');
    if (exportOptions.uatVersion) headers.push('UAT Version');
    if (exportOptions.prodVersion) headers.push('Prod Version');
    if (exportOptions.poDate) headers.push('PO Date');
    if (exportOptions.startDate) headers.push('Start Date');
    if (exportOptions.remarks) headers.push('Status Remarks');

    const esc = (v: unknown) => {
      if (v == null) return '""';
      return `"${String(v).replace(/"/g, '""').replace(/\n/g, ' ')}"`;
    };

    const rows = [headers.join(',')];
    filteredImplementations.forEach((imp) => {
      const row: string[] = [];
      if (exportOptions.companyName) row.push(esc(imp.company_name));
      if (exportOptions.engineer) row.push(esc(imp.assigned_user_name ?? 'Unassigned'));
      if (exportOptions.status) row.push(esc(imp.status));
      if (exportOptions.targetDate) row.push(esc(imp.expected_end_date));
      if (exportOptions.poc1) row.push(esc(imp.poc_1));
      if (exportOptions.poc2) row.push(esc(imp.poc_2));
      if (exportOptions.licenseUat) row.push(esc(imp.license_uat));
      if (exportOptions.licenseProd) row.push(esc(imp.license_prod));
      if (exportOptions.uatVersion) row.push(esc(imp.uat_version));
      if (exportOptions.prodVersion) row.push(esc(imp.prod_version));
      if (exportOptions.poDate) row.push(esc(imp.po_date));
      if (exportOptions.startDate) row.push(esc(imp.start_date));
      if (exportOptions.remarks) row.push(esc(imp.status_remarks));
      rows.push(row.join(','));
    });

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `implementations_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setIsExportModalOpen(false);
    showNotification('CSV exported!', 'success');
  };

  const f = (v: string | null | undefined) => v || '';

  return (
    <div>
      {/* Header */}
      <div className="page-header flex-wrap gap-4">
        <div>
          <h1 className="page-title">Implementation Tracker</h1>
          <p className="page-subtitle">
            {currentUser?.role === 'ENGINEER'
              ? 'Your assigned deployments'
              : 'Monitor and manage client DMS deployments'}
          </p>
        </div>
        {currentUser?.role !== 'ENGINEER' && (
          <div className="flex gap-2">
            <button onClick={() => setIsExportModalOpen(true)} className="btn-secondary">
              <Download size={16} /> Export
            </button>
            <button onClick={() => setIsAddModalOpen(true)} className="btn-primary">
              <Plus size={16} /> New Project
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search by company or POC…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9"
            aria-label="Search implementations"
          />
        </div>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
          <button
            onClick={() => setStatusFilter('All')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${statusFilter === 'All' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            All
          </button>
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${statusFilter === s ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {STATUS_STYLES[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Client & Assignment</th>
                <th scope="col">Progress</th>
                <th scope="col">Status</th>
                <th scope="col">Target Date</th>
                <th scope="col" className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredImplementations.map((imp) => {
                const style = STATUS_STYLES[imp.status] ?? STATUS_STYLES.InProgress;
                return (
                  <tr key={imp.id}>
                    <td>
                      <p className="font-semibold text-gray-900">{imp.company_name}</p>
                      <div className="flex flex-wrap gap-2 mt-0.5 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <User size={11} aria-hidden="true" /> POC: {imp.poc_1 ?? 'None'}
                        </span>
                        <span className="flex items-center gap-1 text-blue-700 font-medium">
                          <UserCheck size={11} aria-hidden="true" />
                          {imp.assigned_user_name ?? 'Unassigned'}
                        </span>
                      </div>
                    </td>
                    <td className="w-52">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${imp.current_percentage >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                            style={{ width: `${imp.current_percentage}%` }}
                            role="progressbar"
                            aria-valuenow={imp.current_percentage}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          />
                        </div>
                        <span className="text-sm font-semibold text-gray-700 w-10 text-right">
                          {Math.round(imp.current_percentage)}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`${style.badge} cursor-default`}
                        title={imp.status_remarks ?? ''}
                      >
                        {style.icon}
                        {style.label}
                      </span>
                    </td>
                    <td>
                      <span className="flex items-center gap-1.5 text-gray-600">
                        <Calendar size={13} aria-hidden="true" />
                        {imp.expected_end_date
                          ? new Date(imp.expected_end_date).toLocaleDateString()
                          : 'TBD'}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => navigate(`/implementations/${imp.id}`)}
                        className="btn-secondary text-xs py-1.5"
                        aria-label={`View details for ${imp.company_name}`}
                      >
                        View <ExternalLink size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredImplementations.length === 0 && (
            <div className="py-16 text-center">
              <Search size={40} className="mx-auto text-gray-300 mb-3" aria-hidden="true" />
              <p className="font-semibold text-gray-600">No projects found</p>
              <p className="text-sm text-gray-400 mt-1">
                {currentUser?.role === 'ENGINEER'
                  ? "You don't have any projects assigned yet."
                  : 'Try adjusting your search or add a new project.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Add Project Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Start New Implementation"
        maxWidth="max-w-2xl"
        footer={
          <>
            <button onClick={() => setIsAddModalOpen(false)} className="btn-secondary">Cancel</button>
            <button form="add-impl-form" type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Creating…' : 'Create Project'}
            </button>
          </>
        }
      >
        <form id="add-impl-form" onSubmit={handleAddImplementation} noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group col-span-2 sm:col-span-1">
              <label htmlFor="company_name" className="label">Company Name <span className="text-red-500">*</span></label>
              <input id="company_name" required type="text" value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="input" />
            </div>
            <div className="form-group col-span-2 sm:col-span-1">
              <label htmlFor="engineer" className="label">Assign Engineer</label>
              <select id="engineer" value={formData.assigned_user_id_str}
                onChange={(e) => setFormData({ ...formData, assigned_user_id_str: e.target.value })}
                className="input">
                <option value="">— Unassigned —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="poc1" className="label">POC 1</label>
              <input id="poc1" type="text" value={f(formData.poc_1)}
                onChange={(e) => setFormData({ ...formData, poc_1: e.target.value || null })}
                className="input" />
            </div>
            <div className="form-group">
              <label htmlFor="poc2" className="label">POC 2</label>
              <input id="poc2" type="text" value={f(formData.poc_2)}
                onChange={(e) => setFormData({ ...formData, poc_2: e.target.value || null })}
                className="input" />
            </div>
            <div className="form-group">
              <label htmlFor="uat_version" className="label">UAT Version</label>
              <input id="uat_version" type="text" value={f(formData.uat_version)}
                onChange={(e) => setFormData({ ...formData, uat_version: e.target.value || null })}
                className="input" />
            </div>
            <div className="form-group">
              <label htmlFor="prod_version" className="label">Prod Version</label>
              <input id="prod_version" type="text" value={f(formData.prod_version)}
                onChange={(e) => setFormData({ ...formData, prod_version: e.target.value || null })}
                className="input" />
            </div>
            <div className="form-group">
              <label htmlFor="status" className="label">Status</label>
              <select id="status" value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as ImplementationStatus })}
                className="input">
                <option value="InProgress">In Progress</option>
                <option value="OnHold">On Hold</option>
                <option value="Blocked">Blocked</option>
                <option value="Live">Live</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="po_date" className="label">PO Date</label>
              <input id="po_date" type="date" value={f(formData.po_date)}
                onChange={(e) => setFormData({ ...formData, po_date: e.target.value || null })}
                className="input" />
            </div>
            <div className="form-group">
              <label htmlFor="start_date" className="label">Start Date</label>
              <input id="start_date" type="date" value={f(formData.start_date)}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value || null })}
                className="input" />
            </div>
            <div className="form-group">
              <label htmlFor="end_date" className="label">Target End Date</label>
              <input id="end_date" type="date" value={f(formData.expected_end_date)}
                onChange={(e) => setFormData({ ...formData, expected_end_date: e.target.value || null })}
                className="input" />
            </div>
            {(formData.status === 'Blocked' || formData.status === 'OnHold') && (
              <div className="form-group col-span-2">
                <label htmlFor="status_remarks" className="label">
                  Status Remarks <span className="text-red-500">*</span>
                </label>
                <textarea id="status_remarks" required rows={2}
                  value={f(formData.status_remarks)}
                  onChange={(e) => setFormData({ ...formData, status_remarks: e.target.value || null })}
                  className="input resize-none"
                  placeholder={`Reason for ${formData.status === 'OnHold' ? 'On Hold' : 'Blocked'} status…`}
                />
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Export Modal */}
      <Modal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Export Projects"
        footer={
          <>
            <button onClick={() => setIsExportModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleExportCSV} className="btn-dark">
              <Download size={16} /> Download CSV
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-500 mb-4">Select columns to include in the export.</p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(exportOptions) as (keyof typeof exportOptions)[]).map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={exportOptions[key]}
                onChange={() => setExportOptions((prev) => ({ ...prev, [key]: !prev[key] }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
            </label>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default Implementations;
