import React, { useEffect, useState } from 'react';
import api from '../api';
import { Info } from 'lucide-react';

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

  const MetricCard = ({ title, value, color, info }: { title: string, value: any, color?: string, info: string }) => (
    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>{title}</h3>
        <div title={info} style={{ cursor: 'help', color: '#9ca3af', display: 'flex' }}>
          <Info size={14} />
        </div>
      </div>
      <p style={{ margin: 0, fontSize: '1.875rem', fontWeight: 700, color: color || '#111827' }}>{value}</p>
    </div>
  );

  return (
    <div className="dashboard" style={{ paddingBottom: '3rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', marginBottom: '1.5rem' }}>
        Dashboard Summary
      </h1>
      
      {/* Installation Tracker Section */}
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#4b5563', marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        Installation Tracker
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <MetricCard 
          title="Total Clients" 
          value={summary.total_clients} 
          info="Total number of unique clients in the system."
        />
        <MetricCard 
          title="Tasks Completed" 
          value={<>{summary.completed_tasks} <span style={{ fontSize: '1rem', color: '#9ca3af', fontWeight: 400 }}>/ {summary.total_tasks}</span></>}
          info="Proportion of installation tasks marked as completed across all locations."
        />
        <MetricCard 
          title="Installation Progress" 
          value={`${summary.overall_progress}%`}
          color="#10b981"
          info="The average completion percentage of all installation tasks."
        />
        <MetricCard 
          title="Delayed Tasks" 
          value={summary.delayed_tasks}
          color="#ef4444"
          info="Tasks that are past their due date and not yet completed."
        />
      </div>

      {/* Implementation Tracker Section */}
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#4b5563', marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Implementation Tracker
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <MetricCard 
          title="Total Projects" 
          value={summary.total_implementations}
          info="Total number of software implementation projects currently active or completed."
        />
        <MetricCard 
          title="Live Projects" 
          value={summary.live_implementations}
          color="#10b981"
          info="Projects that have been successfully deployed and are now 'Live'."
        />
        <MetricCard 
          title="Stagnant Projects" 
          value={summary.stagnant_implementations}
          color={summary.stagnant_implementations > 0 ? '#f59e0b' : '#10b981'}
          info="Projects 'In Progress' or 'On Hold' that haven't had a daily log entry in the last 3 days."
        />
        <MetricCard 
          title="Active (In Progress)" 
          value={summary.implementations_by_status?.InProgress || 0}
          color="#3b82f6"
          info="Total number of projects currently in the implementation phase."
        />
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
