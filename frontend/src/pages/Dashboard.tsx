import React, { useEffect, useState, useRef } from 'react';
import api from '../api';
import { Info, Sparkles, RefreshCw, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [delays, setDelays] = useState<any[]>([]);
  
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [summaryType, setSummaryType] = useState<string>('implementation');

  // Chat State
  const [clients, setClients] = useState<any[]>([]);
  const [implementations, setImplementations] = useState<any[]>([]);
  const [selectedChatClient, setSelectedChatClient] = useState<string>('all');
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'ai', content: string}[]>([]);
  const [isChatting, setIsChatting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      const container = messagesEndRef.current.parentElement;
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [sumRes, delRes, clientsRes, impRes] = await Promise.all([
          api.get('/dashboard/summary'),
          api.get('/dashboard/delays'),
          api.get('/clients/?limit=1000'), // Fetch all clients for the dropdown
          api.get('/implementations/') // Fetch all implementations for the dropdown
        ]);
        setSummary(sumRes.data);
        setDelays(delRes.data);
        setClients(clientsRes.data);
        setImplementations(impRes.data);
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
      }
    };
    fetchDashboard();
  }, []);

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    setAiSummary(null);
    try {
      const res = await api.get(`/dashboard/ai-summary?summary_type=${summaryType}`);
      setAiSummary(res.data.summary);
    } catch (err) {
      console.error(err);
      setAiSummary("Failed to generate summary. Please check backend logs and ensure your GEMINI_API_KEY is set in the .env file.");
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    setChatHistory([]);
  }, [summaryType, selectedChatClient]);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsChatting(true);

    try {
      const payload: any = {
        query: userMsg,
        summary_type: summaryType,
        history: chatHistory
      };
      if (selectedChatClient !== 'all') {
        payload.client_id = parseInt(selectedChatClient);
      }

      const res = await api.post('/dashboard/ai-chat', payload);
      setChatHistory(prev => [...prev, { role: 'ai', content: res.data.reply }]);
    } catch (err) {
      console.error(err);
      setChatHistory(prev => [...prev, { role: 'ai', content: "Sorry, I encountered an error while fetching the answer." }]);
    } finally {
      setIsChatting(false);
    }
  };

  if (!summary) return <div style={{ padding: '2rem' }}>Loading dashboard...</div>;

  const MetricCard = ({ title, value, color, info, details }: { title: string, value: any, color?: string, info: string, details?: string[] }) => {
    const tooltipText = details && details.length > 0 ? `${info}\n\nProjects:\n- ${details.join('\n- ')}` : info;
    
    return (
      <div 
        title={tooltipText}
        style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', position: 'relative' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>{title}</h3>
          <div style={{ cursor: 'help', color: '#9ca3af', display: 'flex' }}>
            <Info size={14} />
          </div>
        </div>
        <p style={{ margin: 0, fontSize: '1.875rem', fontWeight: 700, color: color || '#111827' }}>{value}</p>
      </div>
    );
  };

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
          details={summary.delayed_task_details}
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
          details={summary.live_implementation_details}
        />
        <MetricCard 
          title="Stagnant Projects" 
          value={summary.stagnant_implementations}
          color={summary.stagnant_implementations > 0 ? '#f59e0b' : '#10b981'}
          info="Projects 'In Progress' or 'On Hold' that haven't had a daily log entry in the last 3 days."
          details={summary.stagnant_implementation_details}
        />
        <MetricCard 
          title="Active (In Progress)" 
          value={summary.implementations_by_status?.InProgress || 0}
          color="#3b82f6"
          info="Total number of projects currently in the implementation phase."
          details={summary.in_progress_implementation_details}
        />
      </div>

      {/* AI Executive Summary Section */}
      <div style={{ background: 'linear-gradient(to right, #1e3a8a, #312e81)', padding: '2rem', borderRadius: '12px', marginBottom: '2.5rem', color: 'white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: aiSummary ? '2rem' : '0' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={20} style={{ color: '#60a5fa' }} />
              Weekly Executive Summary
            </h2>
            <p style={{ margin: '0 0 1rem 0', color: '#93c5fd', fontSize: '0.875rem' }}>
              Generate an AI-powered summary of activity from the past 7 days.
            </p>
            <select 
              value={summaryType} 
              onChange={(e) => setSummaryType(e.target.value)}
              disabled={isGenerating}
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.2)',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="implementation" style={{ color: '#111827' }}>Implementation Tracker</option>
              <option value="installation" style={{ color: '#111827' }}>Installation Tracker</option>
            </select>
          </div>
          <button 
            onClick={handleGenerateSummary}
            disabled={isGenerating}
            style={{ 
              background: isGenerating ? 'rgba(255,255,255,0.1)' : 'white', 
              color: isGenerating ? 'white' : '#1e3a8a', 
              border: 'none', 
              padding: '0.75rem 1.5rem', 
              borderRadius: '8px', 
              fontWeight: 600, 
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s'
            }}
          >
            {isGenerating ? <><RefreshCw size={18} className="animate-spin" /> Analyzing Logs...</> : 'Generate Summary'}
          </button>
        </div>

        {aiSummary && (
          <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '1.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', lineHeight: 1.6, overflowX: 'auto', marginBottom: '1.5rem' }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h2: ({node, ...props}) => <h2 style={{ marginTop: '1.5rem', color: '#bfdbfe', fontSize: '1.25rem', fontWeight: 600 }} {...props} />,
                h3: ({node, ...props}) => <h3 style={{ marginTop: '1.5rem', color: '#93c5fd', fontSize: '1.1rem', fontWeight: 600 }} {...props} />,
                ul: ({node, ...props}) => <ul style={{ margin: '0.5rem 0 1rem 1.5rem', padding: 0 }} {...props} />,
                li: ({node, ...props}) => <li style={{ marginBottom: '0.25rem' }} {...props} />,
                p: ({node, ...props}) => <p style={{ margin: '0 0 0.75rem 0' }} {...props} />,
                strong: ({node, ...props}) => <strong style={{ color: 'white', fontWeight: 700 }} {...props} />,
                table: ({node, ...props}) => <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', marginBottom: '1rem' }} {...props} />,
                thead: ({node, ...props}) => <thead style={{ background: 'rgba(255,255,255,0.1)' }} {...props} />,
                th: ({node, ...props}) => <th style={{ padding: '0.75rem 1rem', border: '1px solid rgba(255,255,255,0.2)', textAlign: 'left', fontWeight: 600 }} {...props} />,
                td: ({node, ...props}) => <td style={{ padding: '0.75rem 1rem', border: '1px solid rgba(255,255,255,0.2)' }} {...props} />
              }}
            >
              {aiSummary}
            </ReactMarkdown>
          </div>
        )}

        {/* AI Chatbot Section */}
        {aiSummary && (
          <div style={{ background: 'white', borderRadius: '8px', padding: '1.5rem', color: '#111827', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                <Sparkles size={18} style={{ color: '#3b82f6' }} /> Ask Questions About Your Data
              </h3>
              <select 
                value={selectedChatClient} 
                onChange={(e) => setSelectedChatClient(e.target.value)}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '0.875rem',
                  outline: 'none',
                  background: '#f9fafb'
                }}
              >
                <option value="all">All Companies</option>
                {summaryType === 'installation' 
                  ? clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                  : implementations.map(i => <option key={i.id} value={i.id}>{i.company_name}</option>)
                }
              </select>
            </div>

            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {chatHistory.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#6b7280', padding: '2rem 0' }}>
                  Ask me anything about the {summaryType} status for {selectedChatClient === 'all' ? 'all companies' : 'the selected company'}!
                </div>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div key={idx} style={{ 
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    background: msg.role === 'user' ? '#eff6ff' : '#f3f4f6',
                    color: msg.role === 'user' ? '#1e40af' : '#374151',
                    padding: '0.75rem 1rem',
                    borderRadius: '12px',
                    borderBottomRightRadius: msg.role === 'user' ? '2px' : '12px',
                    borderBottomLeftRadius: msg.role === 'user' ? '12px' : '2px',
                    maxWidth: '85%'
                  }}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({node, ...props}) => <p style={{ margin: 0 }} {...props} />,
                        ul: ({node, ...props}) => <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: 0 }} {...props} />,
                        li: ({node, ...props}) => <li style={{ marginBottom: '0.25rem' }} {...props} />,
                        table: ({node, ...props}) => <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem' }} {...props} />,
                        th: ({node, ...props}) => <th style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', textAlign: 'left', fontSize: '0.8rem' }} {...props} />,
                        td: ({node, ...props}) => <td style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', fontSize: '0.8rem' }} {...props} />
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleChatSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder={`Ask about ${summaryType} data...`}
                disabled={isChatting}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none' }}
              />
              <button 
                type="submit"
                disabled={isChatting || !chatInput.trim()}
                style={{ 
                  background: '#3b82f6', color: 'white', border: 'none', padding: '0.75rem 1.25rem', borderRadius: '8px', 
                  cursor: (isChatting || !chatInput.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (isChatting || !chatInput.trim()) ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600
                }}
              >
                {isChatting ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </form>
          </div>
        )}
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
