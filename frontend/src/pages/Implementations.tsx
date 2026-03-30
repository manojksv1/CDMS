import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { 
  Plus, 
  Search, 
  ExternalLink, 
  Calendar, 
  User, 
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  UserCheck
} from 'lucide-react';

const Implementations: React.FC = () => {
  const [implementations, setImplementations] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  const currentUser = useAuthStore(state => state.user);
  const showNotification = useNotificationStore(state => state.show);
  const navigate = useNavigate();

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isQuickClientModalOpen, setIsQuickClientModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    company_name: '',
    zone: '',
    assigned_user_id: '',
    po_date: '',
    poc_name: '',
    version_details: '',
    start_date: '',
    expected_end_date: '',
    status: 'InProgress',
    status_remarks: ''
  });

  const [clientFormData, setClientFormData] = useState({
    name: '',
    zone: '',
    client_location: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const requests: Promise<any>[] = [
        api.get('/implementations/'),
        api.get('/clients/?limit=1000')
      ];
      
      if (currentUser?.role && currentUser.role !== 'ENGINEER') {
        requests.push(api.get('/users/'));
      }
      
      const responses = await Promise.all(requests);
      setImplementations(responses[0]?.data || []);
      setClients(responses[1]?.data || []);
      if (responses[2]) {
        setUsers(responses[2].data.filter((u: any) => u.role === 'ENGINEER'));
      }
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddImplementation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Clean up payload: Convert empty strings to null for dates and IDs
      const payload = { 
        ...formData, 
        assigned_user_id: formData.assigned_user_id ? parseInt(formData.assigned_user_id) : null,
        po_date: formData.po_date || null,
        start_date: formData.start_date || null,
        expected_end_date: formData.expected_end_date || null
      };
      
      await api.post('/implementations/', payload);
      showNotification("Project created and assigned!", "success");
      setIsAddModalOpen(false);
      setFormData({
        company_name: '',
        zone: '',
        assigned_user_id: '',
        po_date: '',
        poc_name: '',
        version_details: '',
        start_date: '',
        expected_end_date: '',
        status: 'InProgress',
        status_remarks: ''
      });
      fetchData();
    } catch (err) {
      console.error("Create Error:", err);
    }
  };

  const handleQuickClientCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/clients/', clientFormData);
      const newClients = [...clients, res.data];
      setClients(newClients);
      setFormData({ 
        ...formData, 
        company_name: res.data.name,
        zone: res.data.zone || '' 
      });
      setIsQuickClientModalOpen(false);
      setClientFormData({ name: '', zone: '', client_location: '' });
      showNotification("Client record created and name copied!", "success");
    } catch (err) {
      console.error("Quick Client Error:", err);
    }
  };

  const handleClientSelect = (clientId: string) => {
    if (!clientId) {
      setFormData({ ...formData, company_name: '', zone: '' });
      return;
    }
    const selectedClient = clients.find(c => c.id.toString() === clientId);
    if (selectedClient) {
      setFormData({ 
        ...formData, 
        company_name: selectedClient.name,
        zone: selectedClient.zone || '' 
      });
    }
  };

  const filteredImplementations = implementations.filter(imp => {
    const cName = imp.company_name?.toLowerCase() || '';
    const pName = imp.poc_name?.toLowerCase() || '';
    const query = searchQuery.toLowerCase();
    
    const matchesSearch = cName.includes(query) || pName.includes(query);
    const matchesStatus = statusFilter === 'All' || imp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Live': return { bg: '#def7ec', text: '#03543f', icon: <CheckCircle2 size={14} /> };
      case 'Blocked': return { bg: '#fde8e8', text: '#9b1c1c', icon: <X size={14} /> };
      case 'OnHold': return { bg: '#fef3c7', text: '#92400e', icon: <AlertCircle size={14} /> };
      case 'Completed': return { bg: '#e1effe', text: '#1e429f', icon: <CheckCircle2 size={14} /> };
      default: return { bg: '#f3f4f6', text: '#374151', icon: <Clock size={14} /> };
    }
  };

  if (isLoading) {
    return <div className="p-10 text-center">Loading Implementations Tracker...</div>;
  }

  return (
    <div className="p-6">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827', marginBottom: '0.25rem' }}>Implementation Tracker</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            {currentUser?.role === 'ENGINEER' ? 'Manage your assigned deployments' : 'Monitor and dispatch ongoing client DMS deployments'}
          </p>
        </div>
        
        {currentUser?.role !== 'ENGINEER' && (
          <button 
            onClick={() => setIsAddModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#1a56db', color: 'white', padding: '0.625rem 1.25rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          >
            <Plus size={18} /> New Project
          </button>
        )}
      </div>

      {/* Filters & Search */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
          <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
          <input 
            type="text" 
            placeholder="Search by company or POC..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.625rem 1rem 0.625rem 2.5rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
          />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', padding: '0.25rem', borderRadius: '8px', border: '1px solid #d1d5db' }}>
          {['All', 'InProgress', 'Live', 'Completed', 'OnHold', 'Blocked'].map((status) => (
            <button 
              key={status}
              onClick={() => setStatusFilter(status)}
              style={{ 
                padding: '0.375rem 0.75rem', 
                borderRadius: '6px', 
                border: 'none', 
                fontSize: '0.875rem', 
                fontWeight: 500, 
                cursor: 'pointer', 
                background: statusFilter === status ? '#f3f4f6' : 'transparent', 
                color: statusFilter === status ? '#111827' : '#6b7280' 
              }}
            >
              {status === 'InProgress' ? 'In Progress' : status === 'OnHold' ? 'On Hold' : status}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Client & Assignment</th>
              <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progress</th>
              <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
              <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target Date</th>
              <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredImplementations.map((imp) => {
              const statusStyle = getStatusColor(imp.status);
              return (
                <tr key={imp.id} style={{ borderBottom: '1px solid #e5e7eb', transition: 'background 0.2s' }}>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 600, color: '#111827', marginBottom: '0.25rem' }}>{imp.company_name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><User size={12} /> POC: {imp.poc_name || 'None'}</span>
                      <span style={{ color: '#e5e7eb' }}>|</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#1a56db', fontWeight: 500 }}><UserCheck size={12} /> Engineer: {imp.assigned_user_name || 'Unassigned'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '1rem', width: '220px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ flex: 1, height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${imp.current_percentage}%`, height: '100%', background: imp.current_percentage === 100 ? '#059669' : '#1a56db', transition: 'width 0.5s ease-out' }} />
                      </div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>{Math.round(imp.current_percentage)}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span 
                      style={{ 
                        display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: statusStyle.bg, color: statusStyle.text,
                        cursor: imp.status_remarks ? 'help' : 'default'
                      }}
                      title={imp.status_remarks || ''}
                    >
                      {statusStyle.icon} {imp.status === 'InProgress' ? 'In Progress' : imp.status === 'OnHold' ? 'On Hold' : imp.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontSize: '0.875rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Calendar size={14} style={{ color: '#6b7280' }} />
                      {imp.expected_end_date ? new Date(imp.expected_end_date).toLocaleDateString() : 'TBD'}
                    </div>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <button onClick={() => navigate(`/implementations/${imp.id}`)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', color: '#374151', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem' }}>
                      View Details <ExternalLink size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredImplementations.length === 0 && !isLoading && (
          <div style={{ padding: '4rem', textAlign: 'center' }}>
            <div style={{ color: '#9ca3af', marginBottom: '1rem' }}><Search size={48} style={{ margin: '0 auto' }} /></div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#374151' }}>No implementation projects found</h3>
            <p style={{ color: '#6b7280' }}>
              {currentUser?.role === 'ENGINEER' 
                ? "You don't have any projects assigned yet." 
                : "Search or add a new project from the CRM to get started."}
            </p>
          </div>
        )}
      </div>

      {/* Add Project Modal */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '600px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Start New Implementation</h2>
              <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={24} /></button>
            </div>
            
            <form onSubmit={handleAddImplementation}>
              <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Lookup Company from CRM</label>
                  <button 
                    type="button"
                    onClick={() => setIsQuickClientModalOpen(true)}
                    style={{ fontSize: '0.75rem', color: '#1a56db', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                  >
                    + Create New CRM Record
                  </button>
                </div>
                <select onChange={e => handleClientSelect(e.target.value)} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white' }}>
                  <option value="">-- Optional: Choose existing --</option>
                  {clients.sort((a,b) => a.name.localeCompare(b.name)).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Company Name *</label>
                  <input required type="text" value={formData.company_name} onChange={e => setFormData({...formData, company_name: e.target.value})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Assign Engineer</label>
                  <select value={formData.assigned_user_id} onChange={e => setFormData({...formData, assigned_user_id: e.target.value})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white' }}>
                    <option value="">-- Unassigned --</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>POC Name</label>
                  <input type="text" value={formData.poc_name} onChange={e => setFormData({...formData, poc_name: e.target.value})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>PO Date</label>
                  <input type="date" value={formData.po_date} onChange={e => setFormData({...formData, po_date: e.target.value})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                </div>
              </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Status</label>
                  <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white' }}>
                    <option value="InProgress">In Progress</option>
                    <option value="OnHold">On Hold</option>
                    <option value="Blocked">Blocked</option>
                    <option value="Live">Live</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              {(formData.status === 'Blocked' || formData.status === 'OnHold') && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Status Remarks (Why is it {formData.status === 'OnHold' ? 'On Hold' : formData.status}?)</label>
                  <textarea 
                    required
                    rows={2} 
                    value={formData.status_remarks} 
                    onChange={e => setFormData({...formData, status_remarks: e.target.value})} 
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db', resize: 'none' }} 
                    placeholder={`Reason for ${formData.status === 'OnHold' ? 'On Hold' : formData.status} status...`}
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Start Date</label>
                  <input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Target End Date</label>
                  <input type="date" value={formData.expected_end_date} onChange={e => setFormData({...formData, expected_end_date: e.target.value})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setIsAddModalOpen(false)} style={{ padding: '0.625rem 1.25rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                <button type="submit" style={{ padding: '0.625rem 1.25rem', background: '#1a56db', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Create Project</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Client Modal */}
      {isQuickClientModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '400px', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem' }}>Create CRM Client Record</h3>
            <form onSubmit={handleQuickClientCreate}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Company Name *</label>
                <input required type="text" value={clientFormData.name} onChange={e => setClientFormData({...clientFormData, name: e.target.value})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }} placeholder="e.g. GE Vernova" />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Zone</label>
                <input type="text" value={clientFormData.zone} onChange={e => setClientFormData({...clientFormData, zone: e.target.value})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }} placeholder="e.g. North" />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Location</label>
                <input type="text" value={clientFormData.client_location} onChange={e => setClientFormData({...clientFormData, client_location: e.target.value})} style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d1d5db' }} placeholder="e.g. Noida" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setIsQuickClientModalOpen(false)} style={{ padding: '0.5rem 1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' }}>Cancel</button>
                <button type="submit" style={{ padding: '0.5rem 1rem', background: '#111827', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' }}>Save & Copy Name</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Implementations;
