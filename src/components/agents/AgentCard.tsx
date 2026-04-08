'use client';

import { memo } from 'react';
import Link from 'next/link';
import { Circle, MessageSquare, Clock, AlertTriangle } from 'lucide-react';
import type { Session } from '@/server/gateway/types';

type AgentStatus = 'active' | 'thinking' | 'idle' | 'error';

function getAgentStatus(sessions: Session[]): AgentStatus {
  if (!sessions.length) return 'idle';
  if (sessions.some(s => s.abortedLastRun)) return 'error';
  return 'idle';
}

const STATUS_COLORS: Record<AgentStatus, string> = {
  active: '#3fb950',
  thinking: '#d29922',
  idle: '#8b949e',
  error: '#f85149',
};

const STATUS_LABELS: Record<AgentStatus, string> = {
  active: 'Active',
  thinking: 'Thinking',
  idle: 'Idle',
  error: 'Error',
};

function timeAgo(ts?: number): string {
  if (!ts) return 'Never';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function getLastMessage(sessions: Session[]): string {
  if (!sessions.length) return 'No sessions';
  const latest = sessions.reduce((a, b) => (a.updatedAt ?? 0) > (b.updatedAt ?? 0) ? a : b);
  return latest.label ?? latest.displayName ?? latest.key;
}

interface AgentCardProps {
  agentId: string;
  sessions: Session[];
  pendingApprovals?: number;
}

export const AgentCard = memo(function AgentCard({
  agentId,
  sessions,
  pendingApprovals = 0,
}: AgentCardProps) {
  const status = getAgentStatus(sessions);
  const color = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];
  const lastMsg = getLastMessage(sessions);
  const latestTs = sessions.reduce((max, s) => Math.max(max, s.updatedAt ?? 0), 0);
  const mainSession = sessions.find(s => s.key.endsWith(':main'));

  return (
    <Link
      href={`/agents/${agentId}`}
      className="block group"
    >
      <div
        className="rounded-xl border p-4 transition-all duration-150 cursor-pointer"
        style={{
          background: '#161b22',
          borderColor: '#30363d',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = '#58a6ff';
          (e.currentTarget as HTMLElement).style.background = '#1c2128';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = '#30363d';
          (e.currentTarget as HTMLElement).style.background = '#161b22';
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            {/* Avatar */}
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-base font-bold flex-shrink-0"
              style={{ background: '#21262d', color: '#58a6ff' }}
            >
              {agentId.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: '#e6edf3' }}>
                {agentId.charAt(0).toUpperCase() + agentId.slice(1)}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Circle size={6} fill={color} stroke="none" />
                <span className="text-xs" style={{ color }}>
                  {label}
                </span>
              </div>
            </div>
          </div>

          {pendingApprovals > 0 && (
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-full"
              style={{ background: '#3d1f1f', border: '1px solid #f85149' }}
            >
              <AlertTriangle size={10} style={{ color: '#f85149' }} />
              <span className="text-xs font-medium" style={{ color: '#f85149' }}>
                {pendingApprovals}
              </span>
            </div>
          )}
        </div>

        {/* Last message */}
        <p
          className="text-xs truncate mb-3"
          style={{ color: '#8b949e' }}
          title={lastMsg}
        >
          {lastMsg}
        </p>

        {/* Footer */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <MessageSquare size={11} style={{ color: '#8b949e' }} />
            <span className="text-xs" style={{ color: '#8b949e' }}>
              {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
            </span>
          </div>
          {mainSession?.model && (
            <span className="text-xs font-mono" style={{ color: '#30363d' }}>
              {mainSession.model.split('-').slice(0, 2).join('-')}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Clock size={11} style={{ color: '#8b949e' }} />
            <span className="text-xs" style={{ color: '#8b949e' }}>
              {timeAgo(latestTs || undefined)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
});
