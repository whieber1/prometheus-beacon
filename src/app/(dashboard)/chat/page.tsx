'use client';

import { useState, useMemo } from 'react';
import { MessageSquare, ChevronDown, Wifi, WifiOff } from 'lucide-react';
import { useGatewayStore } from '@/lib/stores/gateway-store';
import { api } from '@/lib/trpc';
import { ChatPanel } from '@/components/chat/ChatPanel';

function timeAgo(ts?: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function ChatPage() {
  const sessionMap = useGatewayStore(s => s.sessions);
  const connectionState = useGatewayStore(s => s.connectionState);
  const prometheusStatus = useGatewayStore(s => s.prometheusStatus);

  // Also fetch from tRPC (REST) as fallback for initial load
  const { data: restSessions } = api.sessions.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Merge store sessions with REST sessions (store takes priority)
  const sessions = useMemo(() => {
    const merged = new Map<string, { key: string; label?: string; model?: string; updatedAt?: number }>();

    // REST sessions (seed)
    if (restSessions?.sessions) {
      for (const s of restSessions.sessions) {
        merged.set(s.key, {
          key: s.key,
          label: s.label ?? s.key,
          updatedAt: s.updatedAt,
        });
      }
    }

    // Store sessions (override)
    for (const s of Object.values(sessionMap)) {
      merged.set(s.key, {
        key: s.key,
        label: s.label ?? s.key,
        model: s.model,
        updatedAt: s.updatedAt,
      });
    }

    return Array.from(merged.values()).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  }, [sessionMap, restSessions]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const activeKey = selectedKey ?? sessions[0]?.key ?? null;

  const isConnected = connectionState === 'connected';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="px-6 py-3 border-b flex items-center justify-between flex-shrink-0"
        style={{ background: '#161b22', borderColor: '#30363d' }}
      >
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-semibold" style={{ color: '#e6edf3' }}>Chat</h1>
            <p className="text-xs" style={{ color: '#8b949e' }}>
              {sessions.length} session{sessions.length !== 1 ? 's' : ''}
              {prometheusStatus?.model && ` · ${prometheusStatus.model}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection indicator */}
          <div className="flex items-center gap-1.5">
            {isConnected ? (
              <Wifi size={12} style={{ color: '#3fb950' }} />
            ) : (
              <WifiOff size={12} style={{ color: '#f85149' }} />
            )}
            <span className="text-xs" style={{ color: isConnected ? '#3fb950' : '#f85149' }}>
              {connectionState}
            </span>
          </div>

          {/* Session selector */}
          {sessions.length > 0 && (
            <div className="relative">
              <select
                value={activeKey ?? ''}
                onChange={e => setSelectedKey(e.target.value || null)}
                className="text-xs pl-3 pr-7 py-1.5 rounded-md border outline-none appearance-none cursor-pointer"
                style={{
                  background: '#0d1117',
                  borderColor: '#30363d',
                  color: '#e6edf3',
                  minWidth: 200,
                }}
              >
                {sessions.map(s => (
                  <option key={s.key} value={s.key}>
                    {s.label ?? s.key} {s.model ? `(${s.model})` : ''} {timeAgo(s.updatedAt)}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={12}
                className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: '#8b949e' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-hidden">
        {!activeKey ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageSquare size={40} style={{ color: '#30363d' }} className="mx-auto mb-3" />
              <p className="text-sm" style={{ color: '#8b949e' }}>No sessions available</p>
              <p className="text-xs mt-1" style={{ color: '#484f58' }}>
                Start a conversation via Telegram to create a session
              </p>
            </div>
          </div>
        ) : (
          <ChatPanel sessionKey={activeKey} />
        )}
      </div>
    </div>
  );
}
