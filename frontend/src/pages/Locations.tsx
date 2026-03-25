import React, { useEffect, useState } from 'react';
import api from '../api';
import { useNotificationStore } from '../store/notificationStore';
import { Plus, X } from 'lucide-react';

const Locations: React.FC = () => {
  const [locations, setLocations] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', client_id: '', hostname: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const showNotification = useNotificationStore(state => state.show);

  useEffect(() => {
    fetchLocations();
    fetchClients();
  }, []);

  const fetchLocations = async () => {
    try {
      const res = await api.get('/locations/?limit=500');
      setLocations(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await api.get('/clients/?limit=500');
      setClients(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/locations/', {
        name: formData.name,
        client_id: parseInt(formData.client_id),
        hostname: formData.hostname
      });
      setIsModalOpen(false);
      setFormData({ name: '', client_id: '', hostname: '' });
      showNotification("Location added successfully!", "success");
      fetchLocations();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getClientName = (id: number) => {
    const client = clients.find(c => c.id === id);
    return client ? client.name : `Client #${id}`;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#111827' }}>Locations Directory</h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#1a56db', color: 'white', padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 500 }}
        >
          <Plus size={16} /> Add Location
        </button>
      </div>
      
      <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            <tr>
              <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>ID</th>
              <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Location Name</th>
              <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Client</th>
              <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Hostname</th>
            </tr>
          </thead>
          <tbody>
            {locations.map((l, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>#{l.id}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 500, color: '#111827' }}>{l.name}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#374151' }}>{getClientName(l.client_id)}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  {l.hostname ? (
                    <span style={{ fontFamily: 'monospace', background: '#f3f4f6', padding: '0.125rem 0.5rem', borderRadius: '4px' }}>
                      {l.hostname}
                    </span>
                  ) : '-'}
                </td>
              </tr>
            ))}
            {locations.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>No locations found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '8px', width: '100%', maxWidth: '500px', padding: '2rem', position: 'relative' }}>
            <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
              <X size={20} />
            </button>
            <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem' }}>Add New Location</h2>
            
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Location Name *</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Client *</label>
                <select required value={formData.client_id} onChange={e => setFormData({...formData, client_id: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', background: 'white' }}>
                  <option value="" disabled>Select a client</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Hostname</label>
                <input type="text" value={formData.hostname} onChange={e => setFormData({...formData, hostname: e.target.value})} placeholder="e.g. srv.example.com" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '0.5rem 1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '0.5rem 1rem', background: '#1a56db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                  {isSubmitting ? 'Saving...' : 'Save Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Locations;