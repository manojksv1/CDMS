import React, { useEffect, useState, useRef, useCallback } from 'react';
import api from '../api';
import { Info, Sparkles, RefreshCw, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CardSkeleton, TableSkeleton } from '../components/Skeleton';
import type {
  DashboardSummary,
  DelayedTaskDetail,
  Implementation,
  Client,
  ChatMessage,
} from '../types/api';

// ---------------------------------------------------------------------------
// Metric card
// ---------------------------------------------------------------------------
interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  color?: string;
  info: string;
  details?: string[];
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, color, info, details }) => {
  const tooltip = details?.length
    ? `${info}\n\nProjects:\n- ${details.join('\n- ')}`
    : info;

  return (
    <div className="card p-5" title={tooltip}>
      <div className="flex items-center gap-1.5 mb-2">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <Info size={13} className="text-gray-400 cursor-help" aria-hidden="true" />
      </div>
      <p className={`text-3xl font-bold ${color ?? 'text-gray-900'}`}>{value}</p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [delays, setDelays] = useState<DelayedTaskDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [summaryType, setSummaryType] = useState<'implementation' | 'installation'>('implementation');

  const [clients, setClients] = useState<Client[]>([]);
  const [implementations, setImplementations] = useState<Implementation[]>([]);
  const [selectedChatTarget, setSelectedChatTarget] = useState<string>('all');
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatting, setIsChatting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [chatHistory, scrollToBottom]);

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      try {
        const [sumRes, delRes, clientsRes, impRes] = await Promise.all([
          api.get<DashboardSummary>('/dashboard/summary'),
          api.get<DelayedTaskDetail[]>('/dashboard/delays'),
          api.get<Client[]>('/clients/?limit=1000'),
          api.get<Implementation[]>('/implementations/'),
        ]);
        setSummary(sumRes.data);
        setDelays(delRes.data);
        setClients(clientsRes.data);
        setImplementations(impRes.data);
      } catch {
        // errors shown via interceptor
      } finally {
        setIsLoading(false);
      }
    };
    fetchAll();
  }, []);

  // Reset chat when context changes
  useEffect(() => { setChatHistory([]); }, [summaryType, selectedChatTarget]);

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    setAiSummary(null);
    try {
      const res = await api.get<{ summary: string }>(`/dashboard/ai-summary?summary_type=${summaryType}`);
      setAiSummary(res.data.summary);
    } catch {
      setAiSummary('Failed to generate summary. Ensure GEMINI_API_KEY is configured.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatHistory((prev) => [...prev, { role: 'user', content: userMsg }]);
    setIsChatting(true);
    try {
      const payload: Record<string, unknown> = {
        query: userMsg,
        summary_type: summaryType,
        history: chatHistory,
      };
      if (selectedChatTarget !== 'all') payload.client_id = parseInt(selectedChatTarget);
      const res = await api.post<{ reply: string }>('/dashboard/ai-chat', payload);
      setChatHistory((prev) => [...prev, { role: 'ai', content: res.data.reply }]);
    } catch {
      setChatHistory((prev) => [
        ...prev,
        { role: 'ai', content: 'Sorry, I encountered an error fetching the answer.' },
      ]);
    } finally {
      setIsChatting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <TableSkeleton rows={4} cols={5} />
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-8 pb-10">
      <h1 className="page-title">Dashboard Summary</h1>

      {/* Installation Tracker */}
      <section aria-labelledby="installation-heading">
        <h2 id="installation-heading" className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
          Installation Tracker
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Total Clients" value={summary.total_clients} info="Total unique clients in the system." />
          <MetricCard
            title="Tasks Completed"
            value={
              <>
                {summary.completed_tasks}
                <span className="text-base text-gray-400 font-normal"> / {summary.total_tasks}</span>
              </>
            }
            info="Installation tasks marked as completed."
          />
          <MetricCard
            title="Installation Progress"
            value={`${summary.overall_progress}%`}
            color="text-emerald-600"
            info="Average completion of all installation tasks."
          />
          <MetricCard
            title="Delayed Tasks"
            value={summary.delayed_tasks}
            color={summary.delayed_tasks > 0 ? 'text-red-600' : 'text-emerald-600'}
            info="Tasks past their due date and not completed."
            details={summary.delayed_task_details}
          />
        </div>
      </section>

      {/* Implementation Tracker */}
      <section aria-labelledby="implementation-heading">
        <h2 id="implementation-heading" className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
          Implementation Tracker
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Total Projects" value={summary.total_implementations} info="All software implementation projects." />
          <MetricCard
            title="Live Projects"
            value={summary.live_implementations}
            color="text-emerald-600"
            info="Projects successfully deployed and live."
            details={summary.live_implementation_details}
          />
          <MetricCard
            title="Stagnant Projects"
            value={summary.stagnant_implementations}
            color={summary.stagnant_implementations > 0 ? 'text-amber-600' : 'text-emerald-600'}
            info="In Progress / On Hold with no log in 3+ days."
            details={summary.stagnant_implementation_details}
          />
          <MetricCard
            title="Active (In Progress)"
            value={summary.implementations_by_status?.InProgress ?? 0}
            color="text-blue-600"
            info="Projects currently in the implementation phase."
            details={summary.in_progress_implementation_details}
          />
        </div>
      </section>

      {/* AI Executive Summary */}
      <section
        className="rounded-xl p-6 text-white"
        style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #312e81 100%)' }}
        aria-labelledby="ai-heading"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
          <div>
            <h2 id="ai-heading" className="text-lg font-bold flex items-center gap-2 mb-1">
              <Sparkles size={20} className="text-blue-300" />
              Weekly Executive Summary
            </h2>
            <p className="text-blue-200 text-sm">AI-powered summary of the past 7 days.</p>
            <select
              value={summaryType}
              onChange={(e) => setSummaryType(e.target.value as 'implementation' | 'installation')}
              disabled={isGenerating}
              className="mt-3 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
              aria-label="Select summary type"
            >
              <option value="implementation" className="text-gray-900">Implementation Tracker</option>
              <option value="installation" className="text-gray-900">Installation Tracker</option>
            </select>
          </div>
          <button
            onClick={handleGenerateSummary}
            disabled={isGenerating}
            className="btn bg-white text-blue-900 hover:bg-blue-50 focus:ring-white self-start"
          >
            {isGenerating ? (
              <><RefreshCw size={16} className="animate-spin" /> Analysing…</>
            ) : (
              'Generate Summary'
            )}
          </button>
        </div>

        {aiSummary && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-5 overflow-x-auto">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h2: ({ ...props }) => <h2 className="text-blue-200 text-lg font-semibold mt-4 mb-2" {...props} />,
                h3: ({ ...props }) => <h3 className="text-blue-300 text-base font-semibold mt-3 mb-1" {...props} />,
                p: ({ ...props }) => <p className="mb-2 text-sm leading-relaxed" {...props} />,
                ul: ({ ...props }) => <ul className="list-disc ml-5 mb-3 space-y-1" {...props} />,
                li: ({ ...props }) => <li className="text-sm" {...props} />,
                strong: ({ ...props }) => <strong className="text-white font-bold" {...props} />,
                table: ({ ...props }) => <table className="w-full border-collapse mt-3 mb-3 text-sm" {...props} />,
                th: ({ ...props }) => <th className="border border-white/20 px-3 py-2 text-left font-semibold bg-white/10" {...props} />,
                td: ({ ...props }) => <td className="border border-white/20 px-3 py-2" {...props} />,
              }}
            >
              {aiSummary}
            </ReactMarkdown>
          </div>
        )}

        {/* Chat */}
        {aiSummary && (
          <div className="bg-white rounded-xl p-5 text-gray-900">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
              <h3 className="font-semibold flex items-center gap-2 text-sm">
                <Sparkles size={16} className="text-blue-600" />
                Ask Questions About Your Data
              </h3>
              <select
                value={selectedChatTarget}
                onChange={(e) => setSelectedChatTarget(e.target.value)}
                className="input w-auto text-xs py-1"
                aria-label="Filter by company"
              >
                <option value="all">All Companies</option>
                {summaryType === 'installation'
                  ? clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
                  : implementations.map((i) => <option key={i.id} value={i.id}>{i.company_name}</option>)
                }
              </select>
            </div>

            <div
              className="max-h-72 overflow-y-auto flex flex-col gap-3 mb-4"
              role="log"
              aria-label="Chat history"
              aria-live="polite"
            >
              {chatHistory.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-6">
                  Ask me anything about the {summaryType} data!
                </p>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`max-w-[85%] px-4 py-2.5 rounded-xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'self-end bg-blue-50 text-blue-900 rounded-br-sm'
                        : 'self-start bg-gray-100 text-gray-800 rounded-bl-sm'
                    }`}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ ...props }) => <p className="m-0" {...props} />,
                        ul: ({ ...props }) => <ul className="list-disc ml-4 mt-1" {...props} />,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleChatSubmit} className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={`Ask about ${summaryType} data…`}
                disabled={isChatting}
                className="input flex-1"
                aria-label="Chat input"
              />
              <button
                type="submit"
                disabled={isChatting || !chatInput.trim()}
                className="btn-primary px-3"
                aria-label="Send message"
              >
                {isChatting ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </form>
          </div>
        )}
      </section>

      {/* Delayed Tasks */}
      <section aria-labelledby="delays-heading">
        <h2 id="delays-heading" className="text-lg font-semibold text-gray-900 mb-4">
          Delayed Tasks Breakdown
        </h2>
        {delays.length === 0 ? (
          <div className="card p-8 text-center text-gray-500 text-sm">
            All tasks are currently on schedule. No delays detected.
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Task</th>
                  <th scope="col">Client</th>
                  <th scope="col">Location</th>
                  <th scope="col">Due Date</th>
                  <th scope="col">Days Delayed</th>
                </tr>
              </thead>
              <tbody>
                {delays.map((d, i) => (
                  <tr key={i}>
                    <td className="font-medium text-gray-900">{d.task.name}</td>
                    <td>{d.client.name}</td>
                    <td className="text-gray-500">{d.location.name}</td>
                    <td className="text-gray-500">{d.task.due_date}</td>
                    <td>
                      <span className="font-semibold text-red-600">{d.days_delayed} days</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
