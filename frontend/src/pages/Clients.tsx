import React, { useEffect, useState } from 'react';
import api from '../api';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { Plus, X, ChevronDown, ChevronRight, Edit2, Download, MessageSquare, Send, Reply, Trash, Info } from 'lucide-react';

const Clients: React.FC = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  const currentUser = useAuthStore(state => state.user);
  const showNotification = useNotificationStore(state => state.show);
  
  const [expandedClient, setExpandedClient] = useState<number | null>(null);
  const [expandedLocation, setExpandedLocation] = useState<number | null>(null);
  
  // Modals state
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isEditClientModalOpen, setIsEditClientModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isEditTaskModalOpen, setIsEditTaskModalOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCommentsModalOpen, setIsCommentsModalOpen] = useState(false);

  const [exportClientId, setExportClientId] = useState<number | null>(null);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  const openInfo = (client: any) => {
    setSelectedClient(client);
    setIsInfoModalOpen(true);
  };

  // Comments state
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);

  const [exportOptions, setExportOptions] = useState({
    clientName: true,
    clientLocation: true,
    poc1: true,
    poc2: true,
    licenseUat: true,
    licenseProd: true,
    uatVersion: true,
    prodVersion: true,
    databaseType: true,
    databaseVersion: true,
    clientTags: true,
    clientRemarks: true,
    trackingLocation: true,
    taskName: true,
    taskBuildVersion: true,
    taskDueDate: true,
    taskPOC: true,
    taskStatus: true,
    taskRemarks: true
  });

  const [clientFormData, setClientFormData] = useState({ 
    name: '', database_type: 'MS SQL', database_version: '', 
    zone: '', client_location: '', poc_1: '', poc_2: '', 
    license_uat: '', license_prod: '', uat_version: '', prod_version: '',
    remarks: '', tags: '', location_name: '', existing_client_id: ''
  });
  const [clientCreationMode, setClientCreationMode] = useState<'new'|'existing'>('new');
  const [editTaskFormData, setEditTaskFormData] = useState({ status: '', assigned_to: '', build_version: '', remarks: '' });
  const [createTaskFormData, setCreateTaskFormData] = useState({ name: '', due_date: '', build_version: '', remarks: '', assigned_to: '', client_id: 0, location_id: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchInfo, setShowSearchInfo] = useState(false);
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);

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
      console.error("Fetch data error:", err);
    }
  };

  const fetchComments = async (taskId: number) => {
    try {
      const res = await api.get(`/comments/task/${taskId}`);
      setComments(res.data);
    } catch (err) {
      console.error("Fetch comments error:", err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      await api.post('/comments/', {
        task_id: selectedTask.id,
        content: newComment,
        parent_id: replyTo
      });
      setNewComment('');
      setReplyTo(null);
      showNotification("Comment added!", "success");
      fetchComments(selectedTask.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteComment = async (id: number) => {
    if (window.confirm("Delete this comment?")) {
      try {
        await api.delete(`/comments/${id}`);
        showNotification("Comment deleted", "info");
        fetchComments(selectedTask.id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const openComments = (task: any) => {
    setSelectedTask(task);
    fetchComments(task.id);
    setIsCommentsModalOpen(true);
  };

  const getClientTasks = (clientId: number) => {
    const clientLocs = locations.filter(l => l.client_id === clientId).map(l => l.id);
    return tasks.filter(t => clientLocs.includes(t.location_id));
  };

  const sortedClients = [...clients].sort((a, b) => {
    const aTasks = getClientTasks(a.id);
    const bTasks = getClientTasks(b.id);
    
    const aTotal = aTasks.length;
    const bTotal = bTasks.length;
    
    const aCompleted = aTasks.filter(t => t.status === 'COMPLETED').length;
    const bCompleted = bTasks.filter(t => t.status === 'COMPLETED').length;
    
    // Sort logic: 
    // 1. Projects with 100% completion (and at least one task) at the top.
    // 2. Then projects by completion percentage descending.
    // 3. Fallback to name.
    
    const aPct = aTotal > 0 ? aCompleted / aTotal : 0;
    const bPct = bTotal > 0 ? bCompleted / bTotal : 0;
    
    if (aPct !== bPct) {
      return bPct - aPct;
    }
    
    return a.name.localeCompare(b.name);
  });

  const filteredClients = sortedClients.filter(c => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    if (q.includes('=')) {
      const parts = q.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        
        switch (key) {
          case 'tag':
            return c.tags && c.tags.toLowerCase().includes(value);
          case 'db':
            return (c.database_type && c.database_type.toLowerCase().includes(value)) || 
                   (c.database_version && c.database_version.toLowerCase().includes(value));
          case 'name':
            return c.name.toLowerCase().includes(value);
          case 'status':
            return c.status && c.status.toLowerCase().includes(value);
        }
      }
    }

    return (
      c.name.toLowerCase().includes(q) ||
      (c.database_type && c.database_type.toLowerCase().includes(q)) ||
      (c.database_version && c.database_version.toLowerCase().includes(q)) ||
      (c.remarks && c.remarks.toLowerCase().includes(q)) ||
      (c.tags && c.tags.toLowerCase().includes(q))     
    );
  });

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (clientCreationMode === 'new') {
        const clientData = { ...clientFormData };
        const locationName = clientData.location_name;
        delete (clientData as any).location_name;
        delete (clientData as any).existing_client_id;
        
        const newClient = await api.post('/clients/', clientData);
        await api.post('/locations/', { name: locationName || 'Main Office', client_id: newClient.data.id, hostname: '' });
        showNotification("Client and Default Location created successfully!", "success");
      } else {
        if (!clientFormData.existing_client_id) {
          showNotification("Please select an existing client", "error");
          return;
        }
        await api.post('/locations/', { name: clientFormData.location_name || 'Branch Office', client_id: parseInt(clientFormData.existing_client_id), hostname: '' });
        showNotification("New Location added to existing client successfully!", "success");
      }
      
      setIsClientModalOpen(false);
      setClientFormData({ name: '', database_type: 'MS SQL', database_version: '', zone: '', client_location: '', poc_1: '', poc_2: '', license_uat: '', license_prod: '', uat_version: '', prod_version: '', remarks: '', tags: '', location_name: '', existing_client_id: '' });
      fetchData();
    } catch (err) {
      console.error(err);
      showNotification("Failed to save. Check inputs.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditClient = (client: any) => {
    setSelectedClient(client);
    const clientLocs = locations.filter(l => l.client_id === client.id);
    const defaultLoc = clientLocs.length > 0 ? clientLocs[0] : null;

    setClientFormData({
      name: client.name || '',
      database_type: client.database_type || 'MS SQL',
      database_version: client.database_version || '',
      zone: client.zone || '',
      client_location: client.client_location || '',
      poc_1: client.poc_1 || '',
      poc_2: client.poc_2 || '',
      license_uat: client.license_uat || '',
      license_prod: client.license_prod || '',
      uat_version: client.uat_version || '',
      prod_version: client.prod_version || '',
      remarks: client.remarks || '',
      tags: client.tags || '',
      location_name: defaultLoc ? defaultLoc.name : '',
      existing_client_id: defaultLoc ? defaultLoc.id.toString() : ''
    });
    setIsEditClientModalOpen(true);
  };

  const handleEditClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const clientData = { ...clientFormData };
      const locationName = clientData.location_name;
      const locationId = clientData.existing_client_id;
      delete (clientData as any).location_name;
      delete (clientData as any).existing_client_id;

      await api.patch(`/clients/${selectedClient.id}`, clientData);
      
      if (locationId && locationName) {
        await api.patch(`/locations/${locationId}`, { name: locationName });
      } else if (!locationId && locationName) {
        await api.post('/locations/', { name: locationName, client_id: selectedClient.id, hostname: '' });
      }

      setIsEditClientModalOpen(false);
      setClientFormData({ name: '', database_type: 'MS SQL', database_version: '', zone: '', client_location: '', poc_1: '', poc_2: '', license_uat: '', license_prod: '', uat_version: '', prod_version: '', remarks: '', tags: '', location_name: '', existing_client_id: '' });
      showNotification("Client updated successfully!", "success");
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCreateTask = (clientId: number, locationId?: string) => {
    setCreateTaskFormData({ name: '', due_date: '', build_version: '', remarks: '', assigned_to: '', client_id: clientId, location_id: locationId || '' });
    setIsCreateTaskModalOpen(true);
  };

  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let locationId = createTaskFormData.location_id ? parseInt(createTaskFormData.location_id) : undefined;
      
      if (!locationId) {
        const clientLocation = locations.find(l => l.client_id === createTaskFormData.client_id);
        if (clientLocation) {
          locationId = clientLocation.id;
        } else {
          const newLoc = await api.post('/locations/', { name: 'Main Office', client_id: createTaskFormData.client_id, hostname: '' });
          locationId = newLoc.data.id;
        }
      }

      const newTask = await api.post('/tasks/', {
        name: createTaskFormData.name,
        due_date: createTaskFormData.due_date,
        build_version: createTaskFormData.build_version || null,
        remarks: createTaskFormData.remarks || null,
        location_id: locationId
      });

      if (createTaskFormData.assigned_to) {
        await api.patch(`/tasks/${newTask.data.id}/assign`, { assigned_to: parseInt(createTaskFormData.assigned_to) });
      }

      setIsCreateTaskModalOpen(false);
      showNotification("Task created successfully!", "success");
      fetchData();
    } catch (err: any) {
      console.error(err);
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
      if (editTaskFormData.build_version !== (selectedTask.build_version || '') || editTaskFormData.remarks !== (selectedTask.remarks || '')) {
        await api.patch(`/tasks/${selectedTask.id}`, { 
          build_version: editTaskFormData.build_version,
          remarks: editTaskFormData.remarks
        });
      }
      if (editTaskFormData.status !== selectedTask.status) {
        await api.patch(`/tasks/${selectedTask.id}/status`, { status: editTaskFormData.status });
      }
      if (editTaskFormData.assigned_to !== (selectedTask.assigned_to?.toString() || '') && currentUser?.role !== 'ENGINEER') {
        await api.patch(`/tasks/${selectedTask.id}/assign`, { 
          assigned_to: editTaskFormData.assigned_to ? parseInt(editTaskFormData.assigned_to) : null 
        });
      }
      setIsEditTaskModalOpen(false);
      showNotification("Task updated successfully!", "success");
      fetchData();
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUserName = (id: number) => {
    return users.find(u => u.id === id)?.name || id;
  };

  const openExportModal = (clientId: number | null = null) => {
    console.log("Opening Export Modal for client:", clientId);
    setExportClientId(clientId);
    setIsExportModalOpen(true);
  };

  const handleExportCSV = () => {
    try {
      const headers = [];
    if (exportOptions.clientName) headers.push("Client Name");
    if (exportOptions.clientLocation) headers.push("Client City");
    if (exportOptions.databaseType) headers.push("Database Type");
    if (exportOptions.databaseVersion) headers.push("Database Version");
    if (exportOptions.clientTags) headers.push("Tags");
    if (exportOptions.clientRemarks) headers.push("Client Remarks");
    if (exportOptions.trackingLocation) headers.push("Tracking Location");
    if (exportOptions.taskName) headers.push("Tracking Phase");
    if (exportOptions.taskBuildVersion) headers.push("Build Version");
    if (exportOptions.taskDueDate) headers.push("Due Date");
    if (exportOptions.taskPOC) headers.push("Point of Contact");
    if (exportOptions.taskStatus) headers.push("Status");
    if (exportOptions.taskRemarks) headers.push("Task Remarks");
    
    const csvRows = [];
    csvRows.push(headers.join(","));

    const clientsToExport = exportClientId 
      ? clients.filter(c => c.id === exportClientId)
      : filteredClients;

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""').replace(/\n/g, " ");
      return `"${str}"`;
    };

    clientsToExport.forEach(c => {
      const clientTasks = getClientTasks(c.id);
      if (clientTasks.length === 0) {
        const row = [];
        if (exportOptions.clientName) row.push(escapeCsv(c.name));
        if (exportOptions.clientLocation) row.push(escapeCsv(c.client_location));
        if (exportOptions.databaseType) row.push(escapeCsv(c.database_type));
        if (exportOptions.databaseVersion) row.push(escapeCsv(c.database_version));
        if (exportOptions.clientTags) row.push(escapeCsv(c.tags));
        if (exportOptions.clientRemarks) row.push(escapeCsv(c.remarks));
        if (exportOptions.trackingLocation) row.push('""');
        if (exportOptions.taskName) row.push('""');
        if (exportOptions.taskBuildVersion) row.push('""');
        if (exportOptions.taskDueDate) row.push('""');
        if (exportOptions.taskPOC) row.push('""');
        if (exportOptions.taskStatus) row.push('""');
        if (exportOptions.taskRemarks) row.push('""');
        csvRows.push(row.join(","));
      } else {
        clientTasks.forEach(t => {
          const row = [];
          if (exportOptions.clientName) row.push(escapeCsv(c.name));
          if (exportOptions.clientLocation) row.push(escapeCsv(c.client_location));
          if (exportOptions.databaseType) row.push(escapeCsv(c.database_type));
          if (exportOptions.databaseVersion) row.push(escapeCsv(c.database_version));
          if (exportOptions.clientTags) row.push(escapeCsv(c.tags));
          if (exportOptions.clientRemarks) row.push(escapeCsv(c.remarks));
          
          if (exportOptions.trackingLocation) {
            const taskLoc = locations.find(l => l.id === t.location_id);
            row.push(escapeCsv(taskLoc ? `${taskLoc.name} ${taskLoc.hostname ? `(${taskLoc.hostname})` : ''}`.trim() : ''));
          }
          
          if (exportOptions.taskName) row.push(escapeCsv(t.name));
          if (exportOptions.taskBuildVersion) row.push(escapeCsv(t.build_version));
          if (exportOptions.taskDueDate) row.push(escapeCsv(t.due_date));
          if (exportOptions.taskPOC) row.push(escapeCsv(t.assigned_to ? getUserName(t.assigned_to) : 'Unassigned'));
          if (exportOptions.taskStatus) row.push(escapeCsv(t.status));
          if (exportOptions.taskRemarks) row.push(escapeCsv(t.remarks));
          csvRows.push(row.join(","));
        });
      }
    });

      const csvString = csvRows.join("\n");
      const blob = new Blob(["\ufeff", csvString], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = exportClientId ? `cdms_export_client_${exportClientId}.csv` : "cdms_full_export.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setIsExportModalOpen(false);
      showNotification("CSV exported successfully!", "success");
    } catch (error) {
      console.error("Export failed", error);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100%' }}>
      {/* Header with Search and Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#111827', margin: 0 }}>Installation Tracker</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', position: 'relative', zIndex: 10 }}>
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              placeholder="Search by Client, DB, Remarks..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #d1d5db', minWidth: '250px', background: 'white' }}
            />
            <button
              type="button"
              onMouseEnter={() => setShowSearchInfo(true)}
              onMouseLeave={() => setShowSearchInfo(false)}
              style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b7280', cursor: 'help', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Info size={16} />
            </button>
            {showSearchInfo && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', padding: '1rem', width: '300px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', zIndex: 50, fontSize: '0.875rem', color: '#374151' }}>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: '#111827', fontWeight: 600 }}>Advanced Search Filters</h4>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <li><strong>tag=xyz</strong> (Searches only Tags, e.g., tag=vip)</li>
                  <li><strong>db=xyz</strong> (Searches DB Type/Version, e.g., db=mysql)</li>
                  <li><strong>name=xyz</strong> (Searches strictly by Client Name)</li>
                  <li><strong>poc=xyz</strong> (Searches POC fields)</li>
                  <li><strong>version=xyz</strong> (Searches UAT/Prod versions)</li>
                </ul>
              </div>
            )}
          </div>
          <button 
            type="button"
            onClick={(e) => { e.preventDefault(); openExportModal(null); }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', color: '#111827', padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #d1d5db', cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative', zIndex: 11 }}
          >
            <Download size={16} /> Export
          </button>
          {currentUser?.role !== 'ENGINEER' && (
            <button 
              type="button"
              onClick={() => setIsClientModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#1a56db', color: 'white', padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }}
            >
              <Plus size={16} /> Add Client
            </button>
          )}
        </div>
      </div>
      
      {/* Main Table */}
      <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500, width: '50px' }}>S.No</th>
              <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Client Name</th>
              <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Database</th>
              <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Tags</th>
              <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Remarks</th>
              <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Tasks Status</th>
              <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500, textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map((c, index) => {
              const clientTasks = getClientTasks(c.id);
              const isExpanded = expandedClient === c.id;
              const completedTasks = clientTasks.filter(t => t.status === 'COMPLETED').length;
              
              return (
                <React.Fragment key={c.id}>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', background: isExpanded ? '#f9fafb' : 'white' }}>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                      <button 
                        type="button"
                        onClick={() => setExpandedClient(isExpanded ? null : c.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
                      >
                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </button>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#6b7280', fontWeight: 500 }}>
                      {index + 1}
                    </td>
                    <td 
                      onClick={() => setExpandedClient(isExpanded ? null : c.id)}
                      style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 500, color: '#111827', cursor: 'pointer' }}
                      title="Click to view tracking phases"
                    >
                      {c.name}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#374151' }}>
                      {c.database_type ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ background: '#e5e7eb', padding: '0.125rem 0.5rem', borderRadius: '4px', width: 'fit-content' }}>{c.database_type}</span>
                          {c.database_version && <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>v{c.database_version}</span>}
                        </div>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#374151' }}>
                      {c.tags ? (
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          {c.tags.split(',').map((tag: string, i: number) => (
                            <span key={i} style={{ background: '#def7ec', color: '#03543f', padding: '0.125rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 500 }}>
                              {tag.trim()}
                            </span>
                          ))}
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
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openInfo(c); }}
                        style={{ background: 'none', border: 'none', color: '#111827', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        title="View Details"
                      >
                        <Info size={16} />
                      </button>
                      {currentUser?.role !== 'ENGINEER' && (
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openEditClient(c); }}
                          style={{ background: 'none', border: 'none', color: '#1a56db', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Edit Client"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openExportModal(c.id); }}
                        style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Export Client Data"
                      >
                        <Download size={16} />
                      </button>
                    </td>
                  </tr>
                  
                  {isExpanded && (
                    <tr style={{ background: '#fcfcfd', borderBottom: '1px solid #e5e7eb' }}>
                      <td colSpan={8} style={{ padding: '1.5rem 1rem' }}>
                        {(() => {
                          const clientLocs = locations.filter(l => l.client_id === c.id);
                          const isSingleLocation = clientLocs.length === 1;

                          const renderTasksTable = (locTasks: any[]) => (
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                              <thead style={{ background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
                                <tr>
                                  <th style={{ padding: '0.5rem 1rem', color: '#4b5563', fontSize: '0.75rem', fontWeight: 600 }}>Tracking Phase</th>
                                  <th style={{ padding: '0.5rem 1rem', color: '#4b5563', fontSize: '0.75rem', fontWeight: 600 }}>Build Version</th>
                                  <th style={{ padding: '0.5rem 1rem', color: '#4b5563', fontSize: '0.75rem', fontWeight: 600 }}>Due Date</th>
                                  <th style={{ padding: '0.5rem 1rem', color: '#4b5563', fontSize: '0.75rem', fontWeight: 600 }}>Point of Contact</th>
                                  <th style={{ padding: '0.5rem 1rem', color: '#4b5563', fontSize: '0.75rem', fontWeight: 600 }}>Status</th>
                                  <th style={{ padding: '0.5rem 1rem', color: '#4b5563', fontSize: '0.75rem', fontWeight: 600 }}>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {locTasks.map((t: any) => (
                                  <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, color: '#111827' }}>{t.name}</td>
                                    <td style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', color: '#374151' }}>
                                      {t.build_version ? <span style={{ fontFamily: 'monospace', background: '#f3f4f6', padding: '0.125rem 0.25rem', borderRadius: '4px' }}>{t.build_version}</span> : '-'}
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
                                    <td style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', display: 'flex', gap: '0.75rem' }}>
                                      <button 
                                        type="button"
                                        onClick={() => openComments(t)}
                                        style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                        title="View Discussion"
                                      >
                                        <MessageSquare size={14} />
                                      </button>
                                      <button 
                                        type="button"
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
                          );

                          return (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1rem', color: '#111827', fontWeight: 600 }}>
                                  {isSingleLocation ? 'Tracking Phases' : 'Locations & Tracking Phases'}
                                </h3>
                                {isSingleLocation && currentUser?.role !== 'ENGINEER' && (
                                  <button 
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); openCreateTask(c.id, clientLocs[0].id.toString()); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'white', color: '#1a56db', border: '1px solid #1a56db', padding: '0.375rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
                                  >
                                    <Plus size={14} /> Add Phase
                                  </button>
                                )}
                              </div>

                              {isSingleLocation ? (
                                <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', background: 'white' }}>
                                  {(() => {
                                    const singleLocTasks = tasks.filter(t => t.location_id === clientLocs[0].id);
                                    return singleLocTasks.length > 0 ? renderTasksTable(singleLocTasks) : (
                                      <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.875rem', padding: '1rem' }}>
                                        No tracking tasks have been added yet.
                                      </div>
                                    );
                                  })()}
                                </div>
                              ) : clientLocs.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                  {clientLocs.map(loc => {
                                    const locTasks = tasks.filter(t => t.location_id === loc.id);
                                    const isLocExpanded = expandedLocation === loc.id;
                                    
                                    return (
                                      <div key={loc.id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', background: 'white' }}>
                                        <div 
                                          onClick={() => setExpandedLocation(isLocExpanded ? null : loc.id)}
                                          style={{ padding: '0.75rem 1rem', background: isLocExpanded ? '#f9fafb' : 'white', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: isLocExpanded ? '1px solid #e5e7eb' : 'none' }}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {isLocExpanded ? <ChevronDown size={16} color="#6b7280" /> : <ChevronRight size={16} color="#6b7280" />}
                                            <span style={{ fontWeight: 600, color: '#111827', fontSize: '0.875rem' }}>{loc.name} {loc.hostname ? `(${loc.hostname})` : ''}</span>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>{locTasks.length} Phase{locTasks.length !== 1 ? 's' : ''}</span>
                                            {currentUser?.role !== 'ENGINEER' && (
                                              <button 
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); openCreateTask(c.id, loc.id.toString()); }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: '#f3f4f6', color: '#1a56db', border: '1px solid #d1d5db', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                                              >
                                                <Plus size={12} /> Add Phase
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                        
                                        {isLocExpanded && (
                                          <div style={{ padding: '1rem' }}>
                                            {locTasks.length > 0 ? renderTasksTable(locTasks) : (
                                              <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.875rem', padding: '1rem' }}>
                                                No tracking tasks have been added for this location yet.
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.875rem', padding: '1rem' }}>
                                  No tracking tasks or locations have been added for this client yet.
                                </div>
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
            {clients.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>No clients found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- ALL MODALS BELOW --- */}

      {/* Client Create Modal */}
      {isClientModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', borderRadius: '8px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', position: 'relative' }}>
            <button type="button" onClick={() => setIsClientModalOpen(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
              <X size={20} />
            </button>
            <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', borderBottom: '1px solid #e5e7eb' }}>
              <button type="button" onClick={() => setClientCreationMode('new')} style={{ background: 'none', border: 'none', padding: '0.5rem 0', fontWeight: 600, color: clientCreationMode === 'new' ? '#1a56db' : '#6b7280', borderBottom: clientCreationMode === 'new' ? '2px solid #1a56db' : '2px solid transparent', cursor: 'pointer', marginBottom: '-1px' }}>Create New Company</button>
              <button type="button" onClick={() => setClientCreationMode('existing')} style={{ background: 'none', border: 'none', padding: '0.5rem 0', fontWeight: 600, color: clientCreationMode === 'existing' ? '#1a56db' : '#6b7280', borderBottom: clientCreationMode === 'existing' ? '2px solid #1a56db' : '2px solid transparent', cursor: 'pointer', marginBottom: '-1px' }}>Add Location to Existing</button>
            </div>
            <form onSubmit={handleClientSubmit}>
              {clientCreationMode === 'new' ? (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Client Name *</label>
                    <input required type="text" value={clientFormData.name} onChange={e => setClientFormData({...clientFormData, name: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Default Location Name *</label>
                    <input required type="text" placeholder="e.g. Main Office, HQ" value={clientFormData.location_name} onChange={e => setClientFormData({...clientFormData, location_name: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
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
                      <input type="text" value={clientFormData.database_version} onChange={e => setClientFormData({...clientFormData, database_version: e.target.value})} placeholder="e.g. 2019" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
                    </div>
                  </div>

                  

                  

                  

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Tags</label>
                    <input type="text" value={clientFormData.tags} onChange={e => setClientFormData({...clientFormData, tags: e.target.value})} placeholder="e.g. Urgent, VIP" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
                  </div>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Remarks</label>
                    <textarea rows={3} value={clientFormData.remarks} onChange={e => setClientFormData({...clientFormData, remarks: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}></textarea>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: '1rem', position: 'relative' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Select Company *</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        required={!clientFormData.existing_client_id}
                        type="text" 
                        placeholder="Search and select company..." 
                        value={companySearchQuery} 
                        onChange={e => {
                          setCompanySearchQuery(e.target.value);
                          setClientFormData({...clientFormData, existing_client_id: ''});
                          setIsCompanyDropdownOpen(true);
                        }}
                        onFocus={() => setIsCompanyDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setIsCompanyDropdownOpen(false), 200)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', outline: 'none' }} 
                      />
                      {isCompanyDropdownOpen && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #d1d5db', borderRadius: '4px', maxHeight: '200px', overflowY: 'auto', zIndex: 10, marginTop: '4px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                          {clients.filter(c => c.name.toLowerCase().includes(companySearchQuery.toLowerCase())).length > 0 ? (
                            clients.filter(c => c.name.toLowerCase().includes(companySearchQuery.toLowerCase())).map(c => (
                              <div 
                                key={c.id} 
                                onClick={() => {
                                  setClientFormData({...clientFormData, existing_client_id: c.id.toString()});
                                  setCompanySearchQuery(c.name);
                                  setIsCompanyDropdownOpen(false);
                                }}
                                style={{ padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', fontSize: '0.875rem' }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                              >
                                {c.name}
                              </div>
                            ))
                          ) : (
                            <div style={{ padding: '0.5rem 1rem', color: '#6b7280', fontSize: '0.875rem' }}>No companies found</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>New Location Name *</label>
                    <input required type="text" value={clientFormData.location_name} onChange={e => setClientFormData({...clientFormData, location_name: e.target.value})} placeholder="e.g. Branch Office, HQ" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
                  </div>
                </>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" onClick={() => setIsClientModalOpen(false)} style={{ padding: '0.5rem 1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '0.5rem 1rem', background: '#1a56db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Client Edit Modal */}
      {isEditClientModalOpen && selectedClient && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', borderRadius: '8px', width: '100%', maxWidth: '500px', padding: '2rem', position: 'relative' }}>
            <button type="button" onClick={() => setIsEditClientModalOpen(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
              <X size={20} />
            </button>
            <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem' }}>Edit Client: {selectedClient.name}</h2>
            <form onSubmit={handleEditClientSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Client Name *</label>
                <input required type="text" value={clientFormData.name} onChange={e => setClientFormData({...clientFormData, name: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Default Location Name</label>
                <input type="text" value={clientFormData.location_name} onChange={e => setClientFormData({...clientFormData, location_name: e.target.value})} placeholder="e.g. Main Office, HQ" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
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
                  <input type="text" value={clientFormData.database_version} onChange={e => setClientFormData({...clientFormData, database_version: e.target.value})} placeholder="e.g. 2019" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
                </div>
              </div>

              

              

              

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Tags</label>
                <input type="text" value={clientFormData.tags} onChange={e => setClientFormData({...clientFormData, tags: e.target.value})} placeholder="e.g. Urgent, VIP" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Remarks</label>
                <textarea rows={3} value={clientFormData.remarks} onChange={e => setClientFormData({...clientFormData, remarks: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}></textarea>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" onClick={() => setIsEditClientModalOpen(false)} style={{ padding: '0.5rem 1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '0.5rem 1rem', background: '#1a56db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                  {isSubmitting ? 'Updating...' : 'Update Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Client Info Modal */}
      {isInfoModalOpen && selectedClient && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', borderRadius: '8px', width: '100%', maxWidth: '700px', padding: '2rem', position: 'relative' }}>
            <button type="button" onClick={() => setIsInfoModalOpen(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
              <X size={20} />
            </button>
            <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem', color: '#111827', borderBottom: '2px solid #f3f4f6', paddingBottom: '0.75rem' }}>
              Client Details: {selectedClient.name}
            </h2>

            <div style={{ marginTop: '1rem', paddingTop: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Remarks</label>
              <div style={{ fontSize: '0.875rem', color: '#4b5563', background: '#f9fafb', padding: '1rem', borderRadius: '6px', border: '1px solid #e5e7eb', minHeight: '60px' }}>
                {selectedClient.remarks || 'No remarks provided.'}
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
              <button onClick={() => setIsInfoModalOpen(false)} style={{ padding: '0.5rem 1.5rem', background: '#111827', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Create Modal */}
      {isCreateTaskModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', borderRadius: '8px', width: '100%', maxWidth: '500px', padding: '2rem', position: 'relative' }}>
            <button type="button" onClick={() => setIsCreateTaskModalOpen(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
              <X size={20} />
            </button>
            <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem' }}>Add Tracking Phase</h2>
            <form onSubmit={handleCreateTaskSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Location *</label>
                <select 
                  required={locations.filter(l => l.client_id === createTaskFormData.client_id).length > 0} 
                  value={createTaskFormData.location_id} 
                  onChange={e => setCreateTaskFormData({...createTaskFormData, location_id: e.target.value})} 
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', background: 'white' }}
                >
                  <option value="">-- Select Location --</option>
                  {locations.filter(l => l.client_id === createTaskFormData.client_id).map(l => (
                    <option key={l.id} value={l.id}>{l.name} {l.hostname ? `(${l.hostname})` : ''}</option>
                  ))}
                </select>
                {locations.filter(l => l.client_id === createTaskFormData.client_id).length === 0 && (
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>No locations found. A "Main Office" location will be created automatically.</p>
                )}
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Phase Name *</label>
                <input required type="text" value={createTaskFormData.name} onChange={e => setCreateTaskFormData({...createTaskFormData, name: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Due Date *</label>
                  <input required type="date" value={createTaskFormData.due_date} onChange={e => setCreateTaskFormData({...createTaskFormData, due_date: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Build Version</label>
                  <input type="text" value={createTaskFormData.build_version} onChange={e => setCreateTaskFormData({...createTaskFormData, build_version: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
                </div>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Point of Contact</label>
                <select value={createTaskFormData.assigned_to} onChange={e => setCreateTaskFormData({...createTaskFormData, assigned_to: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', background: 'white' }}>
                  <option value="">-- Unassigned --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', borderRadius: '8px', width: '100%', maxWidth: '500px', padding: '2rem', position: 'relative' }}>
            <button type="button" onClick={() => setIsEditTaskModalOpen(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
              <X size={20} />
            </button>
            <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem' }}>Update Tracking: {selectedTask.name}</h2>
            <form onSubmit={handleEditTaskSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Status *</label>
                  <select 
                    required 
                    disabled={currentUser?.role === 'ENGINEER'}
                    value={editTaskFormData.status} 
                    onChange={e => setEditTaskFormData({...editTaskFormData, status: e.target.value})} 
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', background: currentUser?.role === 'ENGINEER' ? '#f3f4f6' : 'white', cursor: currentUser?.role === 'ENGINEER' ? 'not-allowed' : 'pointer' }}
                  >
                    <option value="NOT_STARTED">Not Started / Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="BLOCKED">Blocked</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Build Version</label>
                  <input 
                    type="text" 
                    disabled={currentUser?.role === 'ENGINEER'}
                    value={editTaskFormData.build_version} 
                    onChange={e => setEditTaskFormData({...editTaskFormData, build_version: e.target.value})} 
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', background: currentUser?.role === 'ENGINEER' ? '#f3f4f6' : 'white', cursor: currentUser?.role === 'ENGINEER' ? 'not-allowed' : 'pointer' }} 
                  />
                </div>
              </div>
              {currentUser?.role !== 'ENGINEER' && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Point of Contact</label>
                  <select value={editTaskFormData.assigned_to} onChange={e => setEditTaskFormData({...editTaskFormData, assigned_to: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', background: 'white' }}>
                    <option value="">-- Unassigned --</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
              )}
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

      {/* Export Modal */}
      {isExportModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', borderRadius: '8px', width: '100%', maxWidth: '500px', padding: '2rem', position: 'relative' }}>
            <button type="button" onClick={() => setIsExportModalOpen(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
              <X size={20} />
            </button>
            <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem' }}>Export Data to CSV</h2>
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>Select the fields you want to include in the CSV export:</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {Object.entries(exportOptions).map(([key, value]) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={value as boolean} 
                      onChange={(e) => setExportOptions({...exportOptions, [key as keyof typeof exportOptions]: e.target.checked})}
                    />
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button type="button" onClick={() => setIsExportModalOpen(false)} style={{ padding: '0.5rem 1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={handleExportCSV} style={{ padding: '0.5rem 1rem', background: '#1a56db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                Download CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discussion Modal */}
      {isCommentsModalOpen && selectedTask && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', borderRadius: '8px', width: '100%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Discussion</h2>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>Task: {selectedTask.name}</p>
              </div>
              <button type="button" onClick={() => setIsCommentsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
              {comments.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#6b7280', padding: '2rem 0' }}>
                  No comments yet. Start the discussion!
                </div>
              ) : (
                <CommentList 
                  comments={comments} 
                  onReply={(id) => setReplyTo(id)} 
                  onDelete={handleDeleteComment} 
                  currentUserId={currentUser?.id} 
                />
              )}
            </div>
            <div style={{ padding: '1.5rem', borderTop: '1px solid #e5e7eb', background: '#f9fafb' }}>
              {replyTo && (
                <div style={{ marginBottom: '0.5rem', fontSize: '0.75rem', color: '#1a56db', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Replying to a comment...</span>
                  <button type="button" onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>Cancel</button>
                </div>
              )}
              <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '0.5rem' }}>
                <textarea 
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Type your message..."
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db', resize: 'none', fontSize: '0.875rem', background: 'white' }}
                  rows={2}
                />
                <button 
                  type="submit" 
                  style={{ background: '#1a56db', color: 'white', border: 'none', borderRadius: '6px', padding: '0 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Sub-components for Comments ---
const CommentList: React.FC<{ 
  comments: any[], 
  onReply: (id: number) => void, 
  onDelete: (id: number) => void,
  currentUserId: number | undefined
}> = ({ comments, onReply, onDelete, currentUserId }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {comments.map(c => (
        <div key={c.id} style={{ borderLeft: c.parent_id ? '2px solid #e5e7eb' : 'none', paddingLeft: c.parent_id ? '1rem' : '0' }}>
          <div style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>{c.user?.name || 'System'}</span>
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{new Date(c.timestamp).toLocaleString()}</span>
            </div>
            <div style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '0.5rem' }}>{c.content}</div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                type="button"
                onClick={() => onReply(c.id)}
                style={{ background: 'none', border: 'none', color: '#1a56db', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: 0 }}
              >
                <Reply size={12} /> Reply
              </button>
              {(currentUserId === c.user_id) && (
                <button 
                  type="button"
                  onClick={() => onDelete(c.id)}
                  style={{ background: 'none', border: 'none', color: '#c81e1e', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: 0 }}
                >
                  <Trash size={12} /> Delete
                </button>
              )}
            </div>
          </div>
          {c.replies && c.replies.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <CommentList comments={c.replies} onReply={onReply} onDelete={onDelete} currentUserId={currentUserId} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default Clients;