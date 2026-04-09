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
import { Send, AlertCircle, Paperclip, X, FileText, FileSpreadsheet } from 'lucide-react';

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
            style={{ width: `${180 + i * 40}px`, height: '48px', background: '#21262d' }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Image preview ────────────────────────────────────────────────────────────

// Accepted file types for the file picker
const ACCEPTED_TYPES = [
  'image/*',
  '.pdf', '.docx', '.xlsx', '.txt', '.md', '.csv', '.json',
  '.yaml', '.yml', '.toml', '.py', '.js', '.ts', '.sh', '.sql',
].join(',');

interface PendingFile {
  dataUrl: string;    // for preview (images) or empty (docs)
  base64: string;     // raw base64 (no data: prefix)
  mimeType: string;
  name: string;
  isImage: boolean;
  size: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FilePreview({ file, onRemove }: { file: PendingFile; onRemove: () => void }) {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const DocIcon = ext === 'xlsx' || ext === 'csv' ? FileSpreadsheet : FileText;

  return (
    <div className="relative inline-flex items-center gap-2 mr-2 mb-2 px-3 py-2 rounded-md border"
      style={{ background: '#0d1117', borderColor: '#30363d' }}
    >
      {file.isImage ? (
        <img src={file.dataUrl} alt={file.name} className="rounded" style={{ maxHeight: 80, maxWidth: 120 }} />
      ) : (
        <DocIcon size={20} style={{ color: '#58a6ff', flexShrink: 0 }} />
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium truncate" style={{ color: '#e6edf3', maxWidth: 150 }}>{file.name}</p>
        <p className="text-xs" style={{ color: '#8b949e' }}>{formatFileSize(file.size)}</p>
      </div>
      <button
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
        style={{ background: '#f85149', color: '#fff' }}
      >
        <X size={10} />
      </button>
    </div>
  );
}

// ─── Main chat panel ──────────────────────────────────────────────────────────

interface ChatPanelInnerProps {
  sessionKey: string;
}

function ChatPanelInner({ sessionKey }: ChatPanelInnerProps) {
  const [input, setInput] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ws = useGatewayStore(state => state.ws) as WebSocket | null;
  const pendingApprovals = useGatewayStore(state => state.pendingApprovals);
  const sessionApprovals = useMemo(
    () => pendingApprovals.filter(a => a.sessionKey === sessionKey),
    [pendingApprovals, sessionKey],
  );

  // Load history once — disable all automatic refetching to prevent scroll jumps
  // and thumbnail disappearing. New messages come via WS, not polling.
  const { data: historyData, isLoading, error } = api.sessions.history.useQuery(
    { sessionKey, limit: 100 },
    {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      staleTime: Infinity,
    },
  );

  // Send mutation (via tRPC)
  const sendMutation = api.sessions.send.useMutation();
  // Files are sent directly via WS chat_upload command (no separate HTTP upload needed)

  // ─── Image handling ───────────────────────────────────────────────────────

  const processFile = useCallback((file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      alert('File too large (max 20 MB)');
      return;
    }

    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      setPendingFiles(prev => [...prev, {
        dataUrl: isImage ? dataUrl : '',
        base64,
        mimeType: file.type || 'application/octet-stream',
        name: file.name || (isImage ? 'image.png' : 'file'),
        isImage,
        size: file.size,
      }]);
    };
    reader.readAsDataURL(file);
  }, []);

  // Paste handler — intercept images from clipboard
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) processFile(file);
        return;
      }
    }
    // Not an image paste — let default text paste happen
  }, [processFile]);

  // Drag-and-drop handler
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (!files) return;
    for (const file of files) {
      processFile(file);
    }
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // File input change
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of files) {
      processFile(file);
    }
    // Reset input so the same file can be selected again
    e.target.value = '';
  }, [processFile]);

  const removeFile = useCallback((index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // ─── Streaming listener ───────────────────────────────────────────────────

  useEffect(() => {
    const unsub = useGatewayStore.subscribe((state, prevState) => {
      const { streamingContent, streamingMessageId, chatMessages } = state;

      if (streamingContent && streamingContent !== prevState.streamingContent) {
        setStreamingMessage({
          role: 'assistant',
          content: streamingContent,
          streaming: true,
          id: streamingMessageId ?? undefined,
        });
      }

      if (chatMessages.length > prevState.chatMessages.length && !streamingContent && prevState.streamingContent) {
        const lastMsg = chatMessages[chatMessages.length - 1];
        setStreamingMessage(null);
        if (lastMsg) {
          setLocalMessages(prev => [...prev, {
            role: lastMsg.role as ChatMessage['role'],
            content: lastMsg.content,
            id: lastMsg.id,
            streaming: false,
          }]);
        }
      }
    });
    return () => unsub();
  }, [sessionKey]);

  // Scroll to bottom — only on new local messages or streaming, not history refetches
  const scrollTrigger = localMessages.length + (streamingMessage ? 1 : 0);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [scrollTrigger]);
  // Also scroll once when history first loads
  const historyLoaded = useRef(false);
  useEffect(() => {
    if (historyData && !historyLoaded.current) {
      historyLoaded.current = true;
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
    }
  }, [historyData]);

  // Merge history with local messages
  const allMessages: ChatMessage[] = useMemo(() => {
    const history = (historyData?.messages ?? []) as ChatMessage[];
    return [...history, ...localMessages];
  }, [historyData, localMessages]);

  // ─── Send message (with optional file attachments) ─────────────────────────

  const handleSend = useCallback(async () => {
    const text = input.trim();
    const files = [...pendingFiles];
    if (!text && files.length === 0) return;
    if (uploading) return;

    // Build display content for user message — thumbnails for images, icons for docs
    const contentParts: Array<{ type: string; text?: string; dataUrl?: string; fileName?: string; fileSize?: number }> = [];
    for (const f of files) {
      if (f.isImage) {
        contentParts.push({ type: 'image', dataUrl: f.dataUrl });
      } else {
        contentParts.push({ type: 'file', fileName: f.name, fileSize: f.size });
      }
    }
    if (text) {
      contentParts.push({ type: 'text', text });
    }
    const userMsg: ChatMessage = {
      role: 'user',
      content: contentParts.length === 1 && contentParts[0].type === 'text'
        ? text
        : contentParts as unknown as ChatMessage['content'],
      id: uuid(),
      createdAt: Date.now(),
    };
    setLocalMessages(prev => [...prev, userMsg]);
    setInput('');
    setPendingFiles([]);

    const wsConn = ws;

    // Send files via WS chat_upload command (processed server-side by Prometheus)
    if (files.length > 0 && wsConn && wsConn.readyState === WebSocket.OPEN) {
      setUploading(true);
      for (const f of files) {
        wsConn.send(JSON.stringify({
          type: 'chat_upload',
          payload: {
            session_id: sessionKey,
            filename: f.name,
            content_base64: f.base64,
            mime_type: f.mimeType,
            caption: files.indexOf(f) === files.length - 1 ? text : '',
          },
        }));
      }
      setUploading(false);
      setStreamingMessage({ role: 'assistant', content: '', streaming: true });
    } else if (text) {
      // Text-only message
      if (wsConn && wsConn.readyState === WebSocket.OPEN) {
        wsConn.send(JSON.stringify({
          type: 'send_message',
          payload: { session_id: sessionKey, content: text },
        }));
        setStreamingMessage({ role: 'assistant', content: '', streaming: true });
      } else {
        sendMutation.mutate(
          { sessionKey, message: text },
          {
            onSuccess: () => {
              setStreamingMessage({ role: 'assistant', content: '', streaming: true });
            },
            onError: (err) => {
              setLocalMessages(prev => [...prev, { role: 'system', content: `Error: ${err.message}` }]);
            },
          },
        );
      }
    }
  }, [input, pendingFiles, uploading, sendMutation, ws, sessionKey]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const canSend = (input.trim() || pendingFiles.length > 0) && !uploading;

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
    <div className="flex flex-col h-full" onDrop={handleDrop} onDragOver={handleDragOver}>
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

        {streamingMessage && <MessageRenderer message={streamingMessage} />}

        {sessionApprovals.map(approval => (
          <ExecApprovalCard
            key={approval.id}
            approval={approval}
            onResolved={() => { useGatewayStore.getState().resolveApproval(approval.id); }}
          />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        className="border-t p-3 flex-shrink-0"
        style={{ borderColor: '#30363d', background: '#161b22' }}
      >
        {/* Pending file previews */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap px-1 mb-2">
            {pendingFiles.map((f, i) => (
              <FilePreview key={i} file={f} onRemove={() => removeFile(i)} />
            ))}
          </div>
        )}

        <div
          className="flex gap-2 rounded-lg p-2 border"
          style={{ background: '#0d1117', borderColor: '#30363d' }}
        >
          {/* File attach button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center w-8 h-8 rounded-md transition-colors flex-shrink-0 self-end"
            style={{ color: '#8b949e' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#58a6ff'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#8b949e'; }}
            title="Attach file (images, PDF, DOCX, XLSX, code, text)"
          >
            <Paperclip size={16} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Text input */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Message… (⌘+Enter to send, paste images, drop files)"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-[#8b949e]"
            style={{ color: '#e6edf3', maxHeight: '120px', overflowY: 'auto' }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="flex items-center justify-center w-8 h-8 rounded-md transition-colors flex-shrink-0 self-end"
            style={{
              background: canSend ? '#1f6feb' : '#21262d',
              color: canSend ? '#fff' : '#8b949e',
            }}
          >
            {uploading ? <StreamingDots /> : <Send size={14} />}
          </button>
        </div>
        <p className="text-xs mt-1 px-1" style={{ color: '#30363d' }}>
          {uploading ? 'Uploading...' : '⌘+Enter to send · paste images · drop files'}
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
