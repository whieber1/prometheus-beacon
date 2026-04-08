'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Circle, MessageSquare, Clock } from 'lucide-react';
import { useGatewayStore } from '@/lib/stores/gateway-store';

function timeAgo(ts?: number): string {
  if (!ts) return 'Never';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

interface SessionNodeProps {
  sessionKey: string;
  label?: string;
  model?: string;
  updatedAt?: number;
  depth?: number;
  isLast?: boolean;
}

function SessionNode({ sessionKey, label, model, updatedAt, depth = 0, isLast = false }: SessionNodeProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = sessionKey.includes(':main') && !sessionKey.includes(':subagent');
  const displayLabel = label ?? sessionKey.split(':').slice(-2).join(':');
  const parts = sessionKey.split(':');
  const agentId = parts[1] ?? 'main';

  const handleOpen = () => {
    router.push(`/agents/${agentId}`);
  };

  return (
    <div style={{ marginLeft: depth > 0 ? '24px' : 0 }}>
      {depth > 0 && (
        <div
          className="absolute left-0 top-0 bottom-0 border-l"
          style={{ borderColor: '#30363d', marginLeft: '-12px' }}
        />
      )}
      <div
        className="relative flex items-center gap-2 px-3 py-2.5 rounded-lg border mb-1 cursor-pointer transition-all"
        style={{ background: '#161b22', borderColor: '#30363d' }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = '#58a6ff';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = '#30363d';
        }}
        onClick={handleOpen}
      >
        <Circle size={7} fill="#3fb950" stroke="none" style={{ flexShrink: 0 }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: '#e6edf3' }}>{displayLabel}</p>
          <p className="text-xs truncate" style={{ color: '#8b949e', fontFamily: 'var(--font-mono)' }}>
            {sessionKey}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {model && (
            <span className="text-xs" style={{ color: '#30363d' }}>
              {model}
            </span>
          )}
          <div className="flex items-center gap-1">
            <Clock size={11} style={{ color: '#8b949e' }} />
            <span className="text-xs" style={{ color: '#8b949e' }}>{timeAgo(updatedAt)}</span>
          </div>
          <MessageSquare size={12} style={{ color: '#8b949e' }} />
        </div>
      </div>
    </div>
  );
}

export default function SessionsPage() {
  const sessionMap = useGatewayStore(s => s.sessions);
  const sessions = Object.values(sessionMap);
  const isLoading = false;

  // Group: root sessions vs subagents
  const roots = sessions.filter(s => !s.key.includes(':subagent:'));
  const subagents = sessions.filter(s => s.key.includes(':subagent:'));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="px-6 py-3 border-b flex items-center justify-between flex-shrink-0"
        style={{ background: '#161b22', borderColor: '#30363d' }}
      >
        <div>
          <h1 className="text-base font-semibold" style={{ color: '#e6edf3' }}>Sessions</h1>
          <p className="text-xs" style={{ color: '#8b949e' }}>
            {sessions.length} active sessions
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="h-14 rounded-lg animate-pulse"
                style={{ background: '#161b22' }}
              />
            ))}
          </div>
        )}

        {!isLoading && sessions.length === 0 && (
          <div className="text-center py-16">
            <MessageSquare size={40} style={{ color: '#30363d' }} className="mx-auto mb-3" />
            <p className="text-sm" style={{ color: '#8b949e' }}>No active sessions</p>
          </div>
        )}

        {!isLoading && sessions.length > 0 && (
          <div className="space-y-1">
            {/* Roots */}
            {roots.map(s => (
              <SessionNode
                key={s.key}
                sessionKey={s.key}
                label={s.label}
                model={s.model}
                updatedAt={s.updatedAt}
                depth={0}
              />
            ))}

            {/* Subagents */}
            {subagents.length > 0 && (
              <div className="pt-3">
                <p className="text-xs uppercase tracking-wider mb-2 px-1" style={{ color: '#8b949e' }}>
                  Subagents
                </p>
                {subagents.map(s => (
                  <SessionNode
                    key={s.key}
                    sessionKey={s.key}
                    label={s.label}
                    model={s.model}
                    updatedAt={s.updatedAt}
                    depth={1}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
