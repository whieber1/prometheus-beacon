'use client';

import { useState } from 'react';
import { useGatewayStore } from '@/lib/stores/gateway-store';
import { Clock, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight, Search } from 'lucide-react';
import type { PrometheusToolCall } from '@/server/gateway/types';

function formatLatency(ms?: number): string {
  if (ms === undefined) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function ToolCallRow({ tc }: { tc: PrometheusToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const isPending = tc.success === undefined;
  const statusColor = isPending ? '#d29922' : tc.success ? '#3fb950' : '#f85149';
  const StatusIcon = isPending ? Loader2 : tc.success ? CheckCircle2 : XCircle;

  return (
    <div
      className="border-b last:border-0"
      style={{ borderColor: '#21262d' }}
    >
      <button
        className="w-full text-left flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#161b22]"
        onClick={() => setExpanded(!expanded)}
      >
        <StatusIcon
          size={14}
          style={{ color: statusColor, flexShrink: 0 }}
          className={isPending ? 'animate-spin' : ''}
        />
        <span className="text-sm font-mono flex-1 truncate" style={{ color: '#e6edf3' }}>
          {tc.tool_name}
        </span>
        <span className="text-xs font-mono flex-shrink-0" style={{ color: '#8b949e' }}>
          {formatLatency(tc.latency_ms)}
        </span>
        {expanded
          ? <ChevronDown size={12} style={{ color: '#8b949e' }} />
          : <ChevronRight size={12} style={{ color: '#8b949e' }} />
        }
      </button>

      {/* Input preview */}
      <div className="px-4 pb-2 -mt-1">
        <p className="text-xs truncate pl-7" style={{ color: '#8b949e' }}>
          {summarizeInputs(tc.inputs)}
        </p>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          <DetailBlock label="Inputs" content={JSON.stringify(tc.inputs, null, 2)} />
          {tc.result && <DetailBlock label="Result" content={tc.result} />}
          {tc.error && <DetailBlock label="Error" content={tc.error} isError />}
        </div>
      )}
    </div>
  );
}

function DetailBlock({ label, content, isError }: { label: string; content: string; isError?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#6e7681' }}>{label}</p>
      <pre
        className="text-xs font-mono p-3 rounded-lg overflow-auto max-h-48"
        style={{
          background: isError ? '#f8514910' : '#0d1117',
          color: isError ? '#f85149' : '#8b949e',
          border: `1px solid ${isError ? '#f8514930' : '#30363d'}`,
        }}
      >
        {content}
      </pre>
    </div>
  );
}

function summarizeInputs(inputs: Record<string, unknown>): string {
  const entries = Object.entries(inputs);
  if (entries.length === 0) return '(no inputs)';
  return entries
    .map(([k, v]) => {
      const s = typeof v === 'string' ? v : JSON.stringify(v);
      return `${k}: ${s.length > 50 ? s.slice(0, 50) + '…' : s}`;
    })
    .join(', ');
}

export default function ToolCallFeed() {
  const toolCalls = useGatewayStore(s => s.toolCalls);
  const [filter, setFilter] = useState('');

  const filtered = filter
    ? toolCalls.filter(tc => tc.tool_name.toLowerCase().includes(filter.toLowerCase()))
    : toolCalls;

  const successCount = toolCalls.filter(tc => tc.success === true).length;
  const failCount = toolCalls.filter(tc => tc.success === false).length;
  const pendingCount = toolCalls.filter(tc => tc.success === undefined).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="px-6 py-3 border-b flex items-center justify-between flex-shrink-0"
        style={{ background: '#161b22', borderColor: '#30363d' }}
      >
        <div>
          <h1 className="text-base font-semibold" style={{ color: '#e6edf3' }}>Tool Call Feed</h1>
          <p className="text-xs" style={{ color: '#8b949e' }}>
            {toolCalls.length} calls · {' '}
            <span style={{ color: '#3fb950' }}>{successCount} ok</span> · {' '}
            <span style={{ color: '#f85149' }}>{failCount} err</span>
            {pendingCount > 0 && (
              <> · <span style={{ color: '#d29922' }}>{pendingCount} running</span></>
            )}
          </p>
        </div>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#8b949e' }} />
          <input
            type="text"
            placeholder="Filter tools..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="text-xs pl-7 pr-3 py-1.5 rounded-md border outline-none transition-colors"
            style={{ background: '#0d1117', borderColor: '#30363d', color: '#e6edf3', width: 180 }}
            onFocus={e => (e.currentTarget.style.borderColor = '#58a6ff')}
            onBlur={e => (e.currentTarget.style.borderColor = '#30363d')}
          />
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <Clock size={40} style={{ color: '#30363d' }} className="mx-auto mb-3" />
            <p className="text-sm" style={{ color: '#8b949e' }}>
              {toolCalls.length === 0 ? 'No tool calls yet — waiting for Prometheus events' : 'No matches'}
            </p>
          </div>
        )}
        {filtered.map(tc => (
          <ToolCallRow key={tc.call_id} tc={tc} />
        ))}
      </div>
    </div>
  );
}
