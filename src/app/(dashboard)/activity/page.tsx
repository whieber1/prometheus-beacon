'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity,
  Circle,
  ChevronDown,
  ChevronRight,
  Trash2,
  Pause,
  Play,
  Download,
  Filter,
  Zap,
  MessageSquare,
  Terminal,
  Users,
  Shield,
  Bot,
  Wifi,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { useGatewayStore, type ActivityEvent, type ActivityCategory } from '@/lib/stores/gateway-store';

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<ActivityCategory, {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: React.ReactNode;
}> = {
  message: {
    label: 'Message',
    color: '#3fb950',
    bg: 'rgba(63,185,80,0.08)',
    border: 'rgba(63,185,80,0.25)',
    icon: <MessageSquare size={11} />,
  },
  tool: {
    label: 'Tool',
    color: '#d2a8ff',
    bg: 'rgba(210,168,255,0.08)',
    border: 'rgba(210,168,255,0.25)',
    icon: <Terminal size={11} />,
  },
  session: {
    label: 'Session',
    color: '#58a6ff',
    bg: 'rgba(88,166,255,0.08)',
    border: 'rgba(88,166,255,0.25)',
    icon: <Users size={11} />,
  },
  approval: {
    label: 'Approval',
    color: '#e3b341',
    bg: 'rgba(227,179,65,0.08)',
    border: 'rgba(227,179,65,0.25)',
    icon: <Shield size={11} />,
  },
  agent: {
    label: 'Agent',
    color: '#79c0ff',
    bg: 'rgba(121,192,255,0.08)',
    border: 'rgba(121,192,255,0.25)',
    icon: <Bot size={11} />,
  },
  system: {
    label: 'System',
    color: '#8b949e',
    bg: 'rgba(139,148,158,0.08)',
    border: 'rgba(139,148,158,0.25)',
    icon: <Zap size={11} />,
  },
  other: {
    label: 'Other',
    color: '#6e7681',
    bg: 'rgba(110,118,129,0.08)',
    border: 'rgba(110,118,129,0.25)',
    icon: <Activity size={11} />,
  },
};

// ─── Connection badge ─────────────────────────────────────────────────────────

function ConnectionBadge() {
  const state = useGatewayStore(s => s.connectionState);

  const map = {
    connected: { icon: <Wifi size={11} />, label: 'Live', color: '#3fb950' },
    connecting: { icon: <RefreshCw size={11} className="animate-spin" />, label: 'Connecting', color: '#e3b341' },
    reconnecting: { icon: <RefreshCw size={11} className="animate-spin" />, label: 'Reconnecting', color: '#e3b341' },
    failed: { icon: <WifiOff size={11} />, label: 'Disconnected', color: '#f85149' },
    idle: { icon: <Circle size={11} />, label: 'Idle', color: '#6e7681' },
  };

  const { icon, label, color } = map[state];

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
    >
      {icon}
      {label}
    </span>
  );
}

// ─── Category badge ───────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: ActivityCategory }) {
  const cfg = CATEGORY_CONFIG[category];
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono font-medium uppercase tracking-wide flex-shrink-0"
      style={{
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        fontSize: '10px',
        minWidth: 62,
        justifyContent: 'center',
      }}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── Format timestamp ─────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 5000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

// ─── Event row ────────────────────────────────────────────────────────────────

function EventRow({ event }: { event: ActivityEvent }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const cfg = CATEGORY_CONFIG[event.category];

  const payloadStr = JSON.stringify(event.payload, null, 2);
  const isExpandable = event.payload !== null && event.payload !== undefined;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(payloadStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="border-b transition-colors"
      style={{ borderColor: '#21262d' }}
    >
      {/* Main row */}
      <div
        className={`flex items-start gap-3 px-4 py-2.5 transition-colors ${isExpandable ? 'cursor-pointer' : ''}`}
        style={{ background: expanded ? '#161b22' : 'transparent' }}
        onMouseEnter={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = '#0d1117'; }}
        onMouseLeave={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        onClick={() => isExpandable && setExpanded(v => !v)}
      >
        {/* Expand toggle */}
        <div className="mt-0.5 flex-shrink-0 w-3">
          {isExpandable ? (
            expanded
              ? <ChevronDown size={12} style={{ color: '#8b949e' }} />
              : <ChevronRight size={12} style={{ color: '#8b949e' }} />
          ) : null}
        </div>

        {/* Category badge */}
        <CategoryBadge category={event.category} />

        {/* Event content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-xs font-mono"
              style={{ color: cfg.color }}
            >
              {event.eventName}
            </span>
            {event.sessionKey && (
              <span
                className="text-xs px-1.5 py-0.5 rounded font-mono"
                style={{ background: '#161b22', color: '#8b949e', border: '1px solid #30363d', fontSize: '10px' }}
              >
                {event.sessionKey.length > 30 ? `…${event.sessionKey.slice(-25)}` : event.sessionKey}
              </span>
            )}
          </div>
          {event.summary && (
            <p
              className="text-xs mt-0.5 truncate"
              style={{ color: '#8b949e', maxWidth: '600px' }}
            >
              {event.summary}
            </p>
          )}
        </div>

        {/* Timestamp */}
        <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
          <span className="text-xs font-mono" style={{ color: '#6e7681' }}>
            {formatTime(event.receivedAt)}
          </span>
          <span className="text-xs" style={{ color: '#484f58', fontSize: '10px' }}>
            {timeAgo(event.receivedAt)}
          </span>
        </div>
      </div>

      {/* Expanded payload */}
      {expanded && isExpandable && (
        <div
          className="px-4 pb-3"
          style={{ background: '#0d1117', borderTop: '1px solid #21262d' }}
        >
          <div className="relative mt-2">
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded transition-colors z-10"
              style={{
                background: copied ? '#3fb95020' : '#21262d',
                color: copied ? '#3fb950' : '#8b949e',
                border: `1px solid ${copied ? '#3fb95040' : '#30363d'}`,
              }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <pre
              className="text-xs overflow-x-auto rounded p-3 pr-16"
              style={{
                background: '#161b22',
                color: '#e6edf3',
                border: '1px solid #30363d',
                fontFamily: 'var(--font-mono)',
                maxHeight: 300,
                lineHeight: 1.5,
              }}
            >
              {payloadStr}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center px-8">
      <Activity size={36} style={{ color: '#30363d' }} className="mb-3" />
      <p className="text-sm font-medium mb-1" style={{ color: '#8b949e' }}>
        {filtered ? 'No events match your filters' : 'No activity yet'}
      </p>
      <p className="text-xs" style={{ color: '#484f58' }}>
        {filtered
          ? 'Try changing the filter or clearing it'
          : 'Events will appear here as agents run tools, send messages, and update sessions'}
      </p>
    </div>
  );
}

// ─── Export helper ────────────────────────────────────────────────────────────

function exportActivity(events: ActivityEvent[]) {
  const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `activity-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main page ────────────────────────────────────────────────────────────────

const ALL_CATEGORIES: ActivityCategory[] = ['message', 'tool', 'session', 'approval', 'agent', 'system', 'other'];

export default function ActivityPage() {
  const activityFeed = useGatewayStore(s => s.activityFeed);
  const sessions = useGatewayStore(s => s.sessions);

  const [categoryFilter, setCategoryFilter] = useState<ActivityCategory | 'all'>('all');
  const [sessionFilter, setSessionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [paused, setPaused] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Frozen feed when paused
  const [frozenFeed, setFrozenFeed] = useState<ActivityEvent[]>([]);
  useEffect(() => {
    if (!paused) setFrozenFeed([]);
  }, [paused]);

  const displayFeed = paused ? frozenFeed : activityFeed;

  const handlePause = useCallback(() => {
    if (!paused) setFrozenFeed([...activityFeed]);
    setPaused(v => !v);
  }, [paused, activityFeed]);

  // Auto-scroll to top (newest events are at top)
  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [activityFeed.length, paused]);

  // Filter
  const filtered = displayFeed.filter(e => {
    if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
    if (sessionFilter !== 'all' && e.sessionKey !== sessionFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !e.eventName.toLowerCase().includes(q) &&
        !(e.summary?.toLowerCase().includes(q)) &&
        !(e.sessionKey?.toLowerCase().includes(q))
      ) return false;
    }
    return true;
  });

  const sessionKeys = Object.keys(sessions);

  // Category counts
  const categoryCounts = displayFeed.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleClear = () => {
    useGatewayStore.setState({ activityFeed: [] });
    if (paused) setFrozenFeed([]);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ── */}
      <div
        className="px-6 py-3 border-b flex-shrink-0"
        style={{ background: '#161b22', borderColor: '#30363d' }}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold" style={{ color: '#e6edf3' }}>Activity</h1>
            <ConnectionBadge />
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <input
              type="text"
              placeholder="Search events…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-lg outline-none transition-colors w-44"
              style={{
                background: '#0d1117',
                border: '1px solid #30363d',
                color: '#e6edf3',
              }}
              onFocus={e => { (e.target as HTMLElement).style.borderColor = '#58a6ff'; }}
              onBlur={e => { (e.target as HTMLElement).style.borderColor = '#30363d'; }}
            />

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors"
              style={{
                background: showFilters ? '#1f6feb20' : '#21262d',
                color: showFilters ? '#58a6ff' : '#8b949e',
                border: `1px solid ${showFilters ? '#1f6feb60' : '#30363d'}`,
              }}
            >
              <Filter size={11} />
              Filters
            </button>

            {/* Pause/Resume */}
            <button
              onClick={handlePause}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors"
              style={{
                background: paused ? '#e3b34120' : '#21262d',
                color: paused ? '#e3b341' : '#8b949e',
                border: `1px solid ${paused ? '#e3b34140' : '#30363d'}`,
              }}
            >
              {paused ? <Play size={11} /> : <Pause size={11} />}
              {paused ? 'Resume' : 'Pause'}
            </button>

            {/* Export */}
            <button
              onClick={() => exportActivity(displayFeed)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors"
              style={{ background: '#21262d', color: '#8b949e', border: '1px solid #30363d' }}
              title="Export as JSON"
            >
              <Download size={11} />
            </button>

            {/* Clear */}
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors"
              style={{ background: '#21262d', color: '#8b949e', border: '1px solid #30363d' }}
              title="Clear feed"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>

        {/* Subtitle */}
        <p className="text-xs" style={{ color: '#8b949e' }}>
          {displayFeed.length} events · {filtered.length} shown
          {paused && (
            <span className="ml-2 px-1.5 py-0.5 rounded text-xs" style={{ background: '#e3b34120', color: '#e3b341' }}>
              PAUSED
            </span>
          )}
        </p>
      </div>

      {/* ── Filter bar ── */}
      {showFilters && (
        <div
          className="px-6 py-3 border-b flex items-center gap-4 flex-shrink-0 flex-wrap"
          style={{ background: '#0d1117', borderColor: '#30363d' }}
        >
          {/* Category filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs" style={{ color: '#6e7681' }}>Category:</span>
            <button
              onClick={() => setCategoryFilter('all')}
              className="px-2.5 py-1 rounded text-xs transition-colors"
              style={{
                background: categoryFilter === 'all' ? '#58a6ff20' : '#21262d',
                color: categoryFilter === 'all' ? '#58a6ff' : '#8b949e',
                border: `1px solid ${categoryFilter === 'all' ? '#58a6ff40' : '#30363d'}`,
              }}
            >
              All ({displayFeed.length})
            </button>
            {ALL_CATEGORIES.map(cat => {
              const cfg = CATEGORY_CONFIG[cat];
              const count = categoryCounts[cat] ?? 0;
              if (count === 0) return null;
              const active = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(active ? 'all' : cat)}
                  className="px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-1"
                  style={{
                    background: active ? `${cfg.color}20` : '#21262d',
                    color: active ? cfg.color : '#8b949e',
                    border: `1px solid ${active ? `${cfg.color}40` : '#30363d'}`,
                  }}
                >
                  {cfg.icon}
                  {cfg.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Session filter */}
          {sessionKeys.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: '#6e7681' }}>Session:</span>
              <select
                value={sessionFilter}
                onChange={e => setSessionFilter(e.target.value)}
                className="text-xs px-2 py-1 rounded outline-none"
                style={{
                  background: '#21262d',
                  color: '#e6edf3',
                  border: '1px solid #30363d',
                  maxWidth: 200,
                }}
              >
                <option value="all">All sessions</option>
                {sessionKeys.map(k => (
                  <option key={k} value={k}>{k.length > 40 ? `…${k.slice(-35)}` : k}</option>
                ))}
              </select>
            </div>
          )}

          {/* Clear filters */}
          {(categoryFilter !== 'all' || sessionFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => { setCategoryFilter('all'); setSessionFilter('all'); setSearchQuery(''); }}
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{ color: '#f85149', background: '#f8514910', border: '1px solid #f8514930' }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* ── Category summary pills ── */}
      <div
        className="px-6 py-2 border-b flex items-center gap-2 overflow-x-auto flex-shrink-0"
        style={{ background: '#0d1117', borderColor: '#21262d' }}
      >
        {ALL_CATEGORIES.map(cat => {
          const cfg = CATEGORY_CONFIG[cat];
          const count = categoryCounts[cat] ?? 0;
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(categoryFilter === cat ? 'all' : cat)}
              className="flex items-center gap-1.5 px-2 py-1 rounded flex-shrink-0 transition-all"
              style={{
                background: categoryFilter === cat ? cfg.bg : 'transparent',
                color: count > 0 ? cfg.color : '#484f58',
                border: `1px solid ${categoryFilter === cat ? cfg.border : 'transparent'}`,
                opacity: count === 0 ? 0.4 : 1,
                fontSize: 11,
              }}
            >
              {cfg.icon}
              <span className="font-mono">{count}</span>
              <span className="capitalize">{cfg.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Event feed ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{ background: '#0d1117' }}
      >
        {filtered.length === 0 ? (
          <EmptyState filtered={categoryFilter !== 'all' || sessionFilter !== 'all' || !!searchQuery} />
        ) : (
          <div>
            {filtered.map(event => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>

      {/* ── Footer status bar ── */}
      <div
        className="px-6 py-2 border-t flex items-center justify-between flex-shrink-0"
        style={{ background: '#161b22', borderColor: '#30363d' }}
      >
        <div className="flex items-center gap-4">
          <span className="text-xs" style={{ color: '#6e7681' }}>
            Buffer: {displayFeed.length}/500 events
          </span>
          {displayFeed.length >= 480 && (
            <span className="text-xs" style={{ color: '#e3b341' }}>
              ⚠ Buffer nearly full — oldest events will be dropped
            </span>
          )}
        </div>
        <span className="text-xs font-mono" style={{ color: '#484f58' }}>
          {filtered.length} / {displayFeed.length} events shown
        </span>
      </div>

    </div>
  );
}
