'use client';

import React, { memo, useState } from 'react';
import Markdown from 'react-markdown';
import { ChevronDown, ChevronRight, Wrench, AlertCircle, Brain } from 'lucide-react';

interface ContentPart {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  arguments?: unknown;
  toolCallId?: string;
  content?: unknown;
  isError?: boolean;
  dataUrl?: string;  // for inline image thumbnails
  fileName?: string; // for document attachments
  fileSize?: number;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool' | 'toolResult';
  content: string | ContentPart[];
  id?: string;
  createdAt?: number;
  runId?: string;
  streaming?: boolean;
  toolCallId?: string;
  toolName?: string;
}

// ─── Text block ───────────────────────────────────────────────────────────────

const TextBlock = memo(function TextBlock({ text }: { text: string }) {
  return (
    <div className="text-sm leading-relaxed prose-invert max-w-none" style={{ color: '#e6edf3' }}>
      <Markdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong style={{ color: '#e6edf3', fontWeight: 600 }}>{children}</strong>,
          em: ({ children }) => <em style={{ color: '#8b949e' }}>{children}</em>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-1" style={{ color: '#e6edf3' }}>{children}</h3>,
          h2: ({ children }) => <h2 className="text-base font-semibold mt-3 mb-1" style={{ color: '#e6edf3' }}>{children}</h2>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="text-sm">{children}</li>,
          code: ({ children, className }) => {
            const isBlock = className?.includes('language-');
            if (isBlock) {
              return (
                <pre className="text-xs font-mono p-3 rounded-lg overflow-auto my-2" style={{ background: '#0d1117', border: '1px solid #30363d' }}>
                  <code style={{ color: '#8b949e' }}>{children}</code>
                </pre>
              );
            }
            return <code className="text-xs font-mono px-1 py-0.5 rounded" style={{ background: '#21262d', color: '#79c0ff' }}>{children}</code>;
          },
          a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" style={{ color: '#58a6ff' }}>{children}</a>,
          table: ({ children }) => <table className="text-xs border-collapse my-2 w-full" style={{ border: '1px solid #30363d' }}>{children}</table>,
          th: ({ children }) => <th className="px-2 py-1 text-left font-semibold" style={{ background: '#161b22', borderBottom: '1px solid #30363d', color: '#8b949e' }}>{children}</th>,
          td: ({ children }) => <td className="px-2 py-1" style={{ borderBottom: '1px solid #21262d' }}>{children}</td>,
        }}
      >
        {text}
      </Markdown>
    </div>
  );
});

// ─── Tool call ────────────────────────────────────────────────────────────────

const ToolCallBlock = memo(function ToolCallBlock({
  name,
  args,
}: {
  name: string;
  args: unknown;
}) {
  const [open, setOpen] = useState(false);
  const argsStr = JSON.stringify(args, null, 2);
  return (
    <div
      className="rounded-md border my-1"
      style={{ background: '#0d1117', borderColor: '#30363d' }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-[#21262d] rounded-md transition-colors"
      >
        <Wrench size={13} style={{ color: '#58a6ff' }} />
        <span className="text-xs font-mono font-medium" style={{ color: '#58a6ff' }}>
          {name}
        </span>
        <span className="ml-auto">
          {open ? (
            <ChevronDown size={13} style={{ color: '#8b949e' }} />
          ) : (
            <ChevronRight size={13} style={{ color: '#8b949e' }} />
          )}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-2">
          <pre
            className="text-xs overflow-x-auto rounded p-2"
            style={{ background: '#161b22', color: '#8b949e', fontFamily: 'var(--font-mono)' }}
          >
            {argsStr}
          </pre>
        </div>
      )}
    </div>
  );
});

// ─── Tool result ──────────────────────────────────────────────────────────────

const ToolResultBlock = memo(function ToolResultBlock({
  content,
  isError,
}: {
  content: unknown;
  isError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const str =
    typeof content === 'string' ? content : JSON.stringify(content, null, 2);

  return (
    <div
      className="rounded-md border my-1"
      style={{
        background: '#0d1117',
        borderColor: isError ? '#f85149' : '#30363d',
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-[#21262d] rounded-md transition-colors"
      >
        {isError ? (
          <AlertCircle size={13} style={{ color: '#f85149' }} />
        ) : (
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: '#3fb950' }}
          />
        )}
        <span
          className="text-xs font-mono"
          style={{ color: isError ? '#f85149' : '#3fb950' }}
        >
          {isError ? 'Error' : 'Result'}
        </span>
        <span className="ml-auto">
          {open ? (
            <ChevronDown size={13} style={{ color: '#8b949e' }} />
          ) : (
            <ChevronRight size={13} style={{ color: '#8b949e' }} />
          )}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-2">
          <pre
            className="text-xs overflow-x-auto rounded p-2 max-h-48"
            style={{
              background: '#161b22',
              color: isError ? '#f85149' : '#8b949e',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {str.slice(0, 10000)}
            {str.length > 10000 && '\n… truncated'}
          </pre>
        </div>
      )}
    </div>
  );
});

// ─── Thinking block ───────────────────────────────────────────────────────────

const ThinkingBlock = memo(function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-md border my-1"
      style={{ background: '#0d1117', borderColor: '#21262d' }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-[#21262d] rounded-md transition-colors"
      >
        <Brain size={13} style={{ color: '#bc8cff' }} />
        <span className="text-xs italic" style={{ color: '#8b949e' }}>
          Thinking…
        </span>
        <span className="ml-auto">
          {open ? (
            <ChevronDown size={13} style={{ color: '#8b949e' }} />
          ) : (
            <ChevronRight size={13} style={{ color: '#8b949e' }} />
          )}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-2">
          <p
            className="text-xs italic whitespace-pre-wrap"
            style={{ color: '#8b949e' }}
          >
            {text}
          </p>
        </div>
      )}
    </div>
  );
});

// ─── System message ───────────────────────────────────────────────────────────

const SystemMessage = memo(function SystemMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-center my-2">
      <span
        className="text-xs px-3 py-1 rounded-full"
        style={{
          background: '#21262d',
          color: '#8b949e',
          border: '1px solid #30363d',
        }}
      >
        {text}
      </span>
    </div>
  );
});

// ─── Streaming dots ───────────────────────────────────────────────────────────

export function StreamingDots() {
  return (
    <span className="inline-flex gap-0.5 items-center ml-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block w-1 h-1 rounded-full animate-bounce"
          style={{
            background: '#8b949e',
            animationDelay: `${i * 0.15}s`,
            animationDuration: '0.9s',
          }}
        />
      ))}
    </span>
  );
}

// ─── Main renderer ────────────────────────────────────────────────────────────

export const MessageRenderer = memo(function MessageRenderer({
  message,
}: {
  message: ChatMessage;
}) {
  const { role, content, streaming } = message;

  if (role === 'system') {
    const text = typeof content === 'string' ? content : 'System event';
    return <SystemMessage text={text} />;
  }

  // Tool results are rendered as assistant messages with tool result blocks
  if (role === 'toolResult' || role === 'tool') {
    const parts: ContentPart[] = Array.isArray(content)
      ? (content as ContentPart[])
      : [{ type: 'toolResult', content: content as string }];
    
    return (
      <div className="flex" style={{ justifyContent: 'flex-start' }}>
        <div
          style={{
            background: '#21262d',
            borderRadius: '2px 12px 12px 12px',
            padding: '8px 14px',
            maxWidth: '90%',
            border: '1px solid #30363d',
            alignSelf: 'flex-start',
          }}
        >
          {parts.map((part, i) => {
            if (part.type === 'toolResult') {
              return (
                <ToolResultBlock
                  key={i}
                  content={part.content}
                  isError={part.isError}
                />
              );
            }
            if (part.type === 'text' && part.text !== undefined) {
              return <TextBlock key={i} text={part.text} />;
            }
            return null;
          })}
        </div>
      </div>
    );
  }

  const isUser = role === 'user';
  const isAssistant = role === 'assistant';

  const parts: ContentPart[] = Array.isArray(content)
    ? (content as ContentPart[])
    : [{ type: 'text', text: content as string }];

  const bubbleStyle: React.CSSProperties = isUser
    ? {
        background: '#1f6feb',
        borderRadius: '12px 12px 2px 12px',
        padding: '8px 14px',
        maxWidth: '80%',
        alignSelf: 'flex-end',
      }
    : {
        background: '#21262d',
        borderRadius: '2px 12px 12px 12px',
        padding: '8px 14px',
        maxWidth: '90%',
        border: '1px solid #30363d',
        alignSelf: 'flex-start',
      };

  return (
    <div
      className="flex"
      style={{ justifyContent: isUser ? 'flex-end' : 'flex-start' }}
    >
      <div style={bubbleStyle}>
        {isAssistant && !isUser && (
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs font-medium" style={{ color: '#8b949e' }}>
              Agent
            </span>
          </div>
        )}
        {parts.map((part, i) => {
          if (part.type === 'image' && part.dataUrl) {
            return (
              <img
                key={i}
                src={part.dataUrl}
                alt="Attached image"
                className="rounded-md my-1"
                style={{ maxHeight: 200, maxWidth: 300, border: '1px solid rgba(255,255,255,0.1)' }}
              />
            );
          }
          if (part.type === 'file' && part.fileName) {
            return (
              <div key={i} className="flex items-center gap-2 my-1 px-2 py-1.5 rounded-md" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <span className="text-xs" style={{ color: '#58a6ff' }}>📎</span>
                <span className="text-xs font-medium" style={{ color: '#e6edf3' }}>{part.fileName}</span>
                {part.fileSize && <span className="text-xs" style={{ color: '#8b949e' }}>({(part.fileSize / 1024).toFixed(0)} KB)</span>}
              </div>
            );
          }
          if (part.type === 'text' && part.text !== undefined) {
            return (
              <React.Fragment key={i}>
                <TextBlock text={part.text} />
                {streaming && i === parts.length - 1 && <StreamingDots />}
              </React.Fragment>
            );
          }
          if (part.type === 'thinking' && part.thinking !== undefined) {
            return <ThinkingBlock key={i} text={part.thinking} />;
          }
          if (part.type === 'toolCall') {
            return (
              <ToolCallBlock key={i} name={part.name ?? 'unknown'} args={part.arguments} />
            );
          }
          if (part.type === 'toolResult') {
            return (
              <ToolResultBlock key={i} content={part.content} isError={part.isError} />
            );
          }
          return null;
        })}
        {streaming && parts.length === 0 && <StreamingDots />}
      </div>
    </div>
  );
});

export type { ChatMessage, ContentPart };
