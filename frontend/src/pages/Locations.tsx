import React, { useEffect, useState, useCallback } from 'react';
import api from '../api';
import { useNotificationStore } from '../store/notificationStore';
import { Plus } from 'lucide-react';
import Modal from '../components/Modal';
import { TableSkeleton } from '../components/Skeleton';
import type { Location, Client, LocationCreate } from '../types/api';

const Locations: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<LocationCreate>({ name: '', client_id: 0, hostname: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const showNotification = useNotificationStore((s) => s.show);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [locRes, clientRes] = await Promise.all([
        api.get<Location[]>('/locations/?limit=500'),
        api.get<Client[]>('/clients/?limit=500'),
      ]);
      setLocations(locRes.data);
      setClients(clientRes.data);
    } catch { /* handled */ } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/locations/', formData);
      setIsModalOpen(false);
      setFormData({ name: '', client_id: 0, hostname: '' });
      showNotification('Location added!', 'success');
      fetchData();
    } catch { /* handled */ } finally { setIsSubmitting(false); }
  };

  const getClientName = (id: number) =>
    clients.find((c) => c.id === id)?.name ?? `Client #${id}`;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Locations Directory</h1>
        <button onClick={() => setIsModalOpen(true)} className="btn-primary">
          <Plus size={16} /> Add Location
        </button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Location Name</th>
                <th scope="col">Client</th>
                <th scope="col">Hostname</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((l) => (
                <tr key={l.id}>
                  <td className="text-gray-400 font-mono text-xs">#{l.id}</td>
                  <td className="font-semibold text-gray-900">{l.name}</td>
                  <td>{getClientName(l.client_id)}</td>
                  <td>
                    {l.hostname ? (
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{l.hostname}</code>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {locations.length === 0 && (
                <tr><td colSpan={4} className="text-center text-gray-400 py-8">No locations found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Location"
        footer={
          <>
            <button onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancel</button>
            <button form="location-form" type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Saving…' : 'Save Location'}
            </button>
          </>
        }
      >
        <form id="location-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="loc-name" className="label">Location Name <span className="text-red-500">*</span></label>
            <input id="loc-name" required type="text" value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input" />
          </div>
          <div className="form-group">
            <label htmlFor="loc-client" className="label">Client <span className="text-red-500">*</span></label>
            <select id="loc-client" required value={formData.client_id || ''}
              onChange={(e) => setFormData({ ...formData, client_id: parseInt(e.target.value) })}
              className="input">
              <option value="" disabled>Select a client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="loc-hostname" className="label">Hostname</label>
            <input id="loc-hostname" type="text" value={formData.hostname ?? ''}
              onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
              placeholder="e.g. srv.example.com" className="input" />
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Locations;
