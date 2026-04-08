'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  Component,
  type ReactNode,
  type ErrorInfo,
} from 'react';
import { Send, AlertCircle } from 'lucide-react';

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
import { api } from '@/lib/trpc';
import { useGatewayStore } from '@/lib/stores/gateway-store';
import { MessageRenderer, StreamingDots, type ChatMessage } from './MessageRenderer';
import { ExecApprovalCard } from './ExecApprovalCard';

// ─── Error boundary ───────────────────────────────────────────────────────────

interface EBState { hasError: boolean; error?: Error }
class ChatErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false };
  static getDerivedStateFromError(error: Error): EBState { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('[ChatPanel] Error:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-6">
            <AlertCircle size={24} style={{ color: '#f85149' }} className="mx-auto mb-2" />
            <p className="text-sm" style={{ color: '#f85149' }}>Chat failed to load</p>
            <p className="text-xs mt-1" style={{ color: '#8b949e' }}>{this.state.error?.message}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ChatSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex" style={{ justifyContent: i % 2 === 0 ? 'flex-end' : 'flex-start' }}>
          <div
            className="rounded-xl animate-pulse"
            style={{
              width: `${180 + i * 40}px`,
              height: '48px',
              background: '#21262d',
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Main chat panel ──────────────────────────────────────────────────────────

interface ChatPanelInnerProps {
  sessionKey: string;
}

function ChatPanelInner({ sessionKey }: ChatPanelInnerProps) {
  const [input, setInput] = useState('');
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const ws = useGatewayStore(state => state.ws) as WebSocket | null;
  const pendingApprovals = useGatewayStore(state => state.pendingApprovals);
  const sessionApprovals = useMemo(
    () => pendingApprovals.filter(a => a.sessionKey === sessionKey),
    [pendingApprovals, sessionKey],
  );

  // Load history
  const { data: historyData, isLoading, error } = api.sessions.history.useQuery(
    { sessionKey, limit: 100 },
    { refetchOnWindowFocus: false },
  );

  // Send mutation (via tRPC)
  const sendMutation = api.sessions.send.useMutation();

  // Listen for streaming events from gateway
  useEffect(() => {
    const store = useGatewayStore.getState();
    const unsub = useGatewayStore.subscribe((state) => {
      // Check activity feed for session-specific events
      const latest = state.activityFeed[0];
      if (!latest) return;
      
      // Handle streaming tokens
      if (latest.eventName === 'session.token' || latest.eventName === 'chat.token') {
        const payload = latest.payload as { sessionKey?: string; token?: string; runId?: string } | undefined;
        if (payload?.sessionKey === sessionKey && payload.token) {
          setStreamingMessage(prev => {
            if (!prev) {
              return {
                role: 'assistant',
                content: payload.token ?? '',
                streaming: true,
                runId: payload.runId,
              };
            }
            const prevContent = typeof prev.content === 'string' ? prev.content : '';
            return { ...prev, content: prevContent + (payload.token ?? '') };
          });
        }
      }

      // Handle message complete
      if (latest.eventName === 'session.complete' || latest.eventName === 'chat.complete') {
        const payload = latest.payload as { sessionKey?: string } | undefined;
        if (payload?.sessionKey === sessionKey) {
          setStreamingMessage(prev => {
            if (prev) {
              setLocalMessages(msgs => [...msgs, { ...prev, streaming: false }]);
            }
            return null;
          });
        }
      }
    });

    return () => unsub();
  }, [sessionKey]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localMessages, streamingMessage, historyData]);

  // Merge history with local messages
  const allMessages: ChatMessage[] = useMemo(() => {
    const history = (historyData?.messages ?? []) as ChatMessage[];
    return [...history, ...localMessages];
  }, [historyData, localMessages]);

  const handleSend = useCallback(() => {
    const msg = input.trim();
    if (!msg || sendMutation.isPending) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: msg,
      id: uuid(),
      createdAt: Date.now(),
    };
    setLocalMessages(prev => [...prev, userMsg]);
    setInput('');

    // Send via WebSocket for real-time, fallback to tRPC
    const wsConn = ws;
    if (wsConn && wsConn.readyState === WebSocket.OPEN) {
      wsConn.send(JSON.stringify({
        type: 'send_message',
        sessionKey,
        message: msg,
        idempotencyKey: userMsg.id!,
      }));
      // Add streaming placeholder
      setStreamingMessage({
        role: 'assistant',
        content: '',
        streaming: true,
      });
    } else {
      sendMutation.mutate(
        { sessionKey, message: msg },
        {
          onSuccess: () => {
            setStreamingMessage({ role: 'assistant', content: '', streaming: true });
          },
          onError: (err) => {
            setLocalMessages(prev => [
              ...prev,
              { role: 'system', content: `Error: ${err.message}` },
            ]);
          },
        },
      );
    }
  }, [input, sendMutation, ws, sessionKey]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  if (isLoading) return <ChatSkeleton />;

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={20} style={{ color: '#f85149' }} className="mx-auto mb-2" />
          <p className="text-sm" style={{ color: '#f85149' }}>Failed to load chat history</p>
          <p className="text-xs mt-1" style={{ color: '#8b949e' }}>{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {allMessages.length === 0 && !streamingMessage && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: '#8b949e' }}>
              No messages yet. Start a conversation.
            </p>
          </div>
        )}

        {allMessages.map((msg, i) => (
          <MessageRenderer key={msg.id ?? i} message={msg} />
        ))}

        {/* Streaming message */}
        {streamingMessage && (
          <MessageRenderer message={streamingMessage} />
        )}

        {/* Pending approvals for this session */}
        {sessionApprovals.map(approval => (
          <ExecApprovalCard
            key={approval.id}
            approval={approval}
            onResolved={() => {
              useGatewayStore.getState().resolveApproval(approval.id);
            }}
          />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        className="border-t p-3 flex-shrink-0"
        style={{ borderColor: '#30363d', background: '#161b22' }}
      >
        <div
          className="flex gap-2 rounded-lg p-2 border"
          style={{ background: '#0d1117', borderColor: '#30363d' }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message… (⌘+Enter to send)"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-[#8b949e]"
            style={{ color: '#e6edf3', maxHeight: '120px', overflowY: 'auto' }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending}
            className="flex items-center justify-center w-8 h-8 rounded-md transition-colors flex-shrink-0 self-end"
            style={{
              background: input.trim() ? '#1f6feb' : '#21262d',
              color: input.trim() ? '#fff' : '#8b949e',
            }}
          >
            {sendMutation.isPending ? (
              <StreamingDots />
            ) : (
              <Send size={14} />
            )}
          </button>
        </div>
        <p className="text-xs mt-1 px-1" style={{ color: '#30363d' }}>
          ⌘+Enter to send
        </p>
      </div>
    </div>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

export function ChatPanel({ sessionKey }: { sessionKey: string }) {
  return (
    <ChatErrorBoundary>
      <ChatPanelInner sessionKey={sessionKey} />
    </ChatErrorBoundary>
  );
}
