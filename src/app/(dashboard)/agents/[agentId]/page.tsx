'use client';

import { use, useState } from 'react';
import { ArrowLeft, Clock, Cpu, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/trpc';
import { ChatPanel } from '@/components/chat/ChatPanel';

interface AgentPageProps {
  params: Promise<{ agentId: string }>;
}

function timeAgo(ts?: number): string {
  if (!ts) return 'Never';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function AgentDetailPage({ params }: AgentPageProps) {
  const { agentId } = use(params);
  const [activeSession, setActiveSession] = useState<string | null>(null);

  const { data: sessionsData, isLoading } = api.agents.sessions.useQuery(undefined, {
    refetchInterval: 15000,
  });

  const agentSessions = (sessionsData?.sessions ?? []).filter(s => {
    const parts = s.key.split(':');
    return parts[1] === agentId;
  });

  const mainSession = agentSessions.find(s => s.key.endsWith(':main'));
  const currentSession = activeSession
    ? agentSessions.find(s => s.key === activeSession)
    : mainSession;

  // Auto-select main session
  if (!activeSession && mainSession) {
    setActiveSession(mainSession.key);
  }

  return (
    <div className="flex h-full">
      {/* Left panel: agent info */}
      <div
        className="w-72 flex-shrink-0 border-r flex flex-col"
        style={{ background: '#161b22', borderColor: '#30363d' }}
      >
        {/* Back + title */}
        <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: '#30363d' }}>
          <Link href="/agents" style={{ color: '#8b949e' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: '#e6edf3' }}>
              {agentId.charAt(0).toUpperCase() + agentId.slice(1)}
            </h2>
            <p className="text-xs" style={{ color: '#8b949e' }}>Agent details</p>
          </div>
        </div>

        {/* Agent stats */}
        <div className="px-4 py-3 border-b space-y-2" style={{ borderColor: '#30363d' }}>
          <div className="flex items-center gap-2">
            <Cpu size={12} style={{ color: '#8b949e' }} />
            <span className="text-xs" style={{ color: '#8b949e' }}>
              {mainSession?.model ?? 'Unknown model'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={12} style={{ color: '#8b949e' }} />
            <span className="text-xs" style={{ color: '#8b949e' }}>
              Last active: {timeAgo(mainSession?.updatedAt)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MessageSquare size={12} style={{ color: '#8b949e' }} />
            <span className="text-xs" style={{ color: '#8b949e' }}>
              {agentSessions.length} sessions
            </span>
          </div>
        </div>

        {/* Sessions list */}
        <div className="px-4 py-3 flex-1 overflow-y-auto">
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: '#8b949e' }}>
            Sessions
          </p>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div
                  key={i}
                  className="h-10 rounded-lg animate-pulse"
                  style={{ background: '#21262d' }}
                />
              ))}
            </div>
          ) : agentSessions.length === 0 ? (
            <p className="text-xs" style={{ color: '#8b949e' }}>No sessions yet</p>
          ) : (
            <div className="space-y-1">
              {agentSessions.map(s => {
                const isActive = (activeSession ?? mainSession?.key) === s.key;
                const label = s.label ?? s.key.split(':').pop() ?? s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => setActiveSession(s.key)}
                    className="w-full text-left px-2.5 py-2 rounded-md text-xs transition-colors"
                    style={{
                      background: isActive ? '#21262d' : 'transparent',
                      color: isActive ? '#e6edf3' : '#8b949e',
                      border: isActive ? '1px solid #30363d' : '1px solid transparent',
                    }}
                  >
                    <p className="font-medium truncate">{label}</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: '#30363d', fontSize: '10px' }}>
                      {s.key}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right panel: chat */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: '#0d1117' }}>
        {currentSession ? (
          <ChatPanel sessionKey={currentSession.key} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm" style={{ color: '#8b949e' }}>
              {agentSessions.length === 0 ? 'No sessions for this agent' : 'Select a session to chat'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
