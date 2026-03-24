import React, { useEffect, useState } from 'react';
import api from '../api';

const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [delays, setDelays] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [sumRes, delRes] = await Promise.all([
          api.get('/dashboard/summary'),
          api.get('/dashboard/delays')
        ]);
        setSummary(sumRes.data);
        setDelays(delRes.data);
      } catch (err) {
        console.error("Failed to fetch dashboard", err);
      }
    };
    fetchDashboard();
  }, []);

  if (!summary) return <div style={{ padding: '2rem' }}>Loading dashboard...</div>;

  return (
    <div className="dashboard">
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#111827', marginBottom: '1.5rem' }}>
        Dashboard Summary
      </h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Total Clients</h3>
          <p style={{ margin: '0.5rem 0 0', fontSize: '1.875rem', fontWeight: 600, color: '#111827' }}>{summary.total_clients}</p>
        </div>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Tasks Completed</h3>
          <p style={{ margin: '0.5rem 0 0', fontSize: '1.875rem', fontWeight: 600, color: '#111827' }}>{summary.completed_tasks} / {summary.total_tasks}</p>
        </div>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Overall Progress</h3>
          <p style={{ margin: '0.5rem 0 0', fontSize: '1.875rem', fontWeight: 600, color: '#046c4e' }}>{summary.overall_progress}%</p>
        </div>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Delayed Tasks</h3>
          <p style={{ margin: '0.5rem 0 0', fontSize: '1.875rem', fontWeight: 600, color: '#c81e1e' }}>{summary.delayed_tasks}</p>
        </div>
      </div>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827', marginBottom: '1rem' }}>Delayed Tasks Breakdown</h2>
      {delays.length === 0 ? (
        <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', textAlign: 'center', color: '#6b7280', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          All tasks are currently on schedule! No delays detected.
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <tr>
                <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Task</th>
                <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Client</th>
                <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Location</th>
                <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Due Date</th>
                <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Days Delayed</th>
              </tr>
            </thead>
            <tbody>
              {delays.map((d, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#111827' }}>{d.task.name}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#111827' }}>{d.client.name}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{d.location.name}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{d.task.due_date}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#c81e1e', fontWeight: 600 }}>{d.days_delayed} days</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
