'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { ChatPanel } from '@/components/chat/ChatPanel';
import {
  CircleDot, CheckCircle2, AlertTriangle, Clock,
  Circle, ExternalLink, ChevronRight, X, MessageSquare
} from 'lucide-react';

type Story = {
  id: string;
  projectId: string | null;
  storyId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignedAgent: string | null;
  sessionKey: string | null;
  dispatchedAt: Date | string | null;
  updatedAt: Date | string;
  createdAt: Date | string;
};

type Project = {
  id: string;
  name: string;
  color: string;
};

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 7 * 86400000) return `${Math.floor(diff / 86400000)}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
    todo:        { color: '#8b949e', bg: '#21262d', icon: Circle,        label: 'TODO' },
    in_progress: { color: '#58a6ff', bg: 'rgba(88,166,255,0.12)', icon: CircleDot,    label: 'RUNNING' },
    blocked:     { color: '#f85149', bg: 'rgba(248,81,73,0.12)',  icon: AlertTriangle, label: 'BLOCKED' },
    done:        { color: '#3fb950', bg: 'rgba(63,185,80,0.12)',  icon: CheckCircle2,  label: 'DONE' },
  };
  const s = map[status] ?? map.todo;
  const Icon = s.icon;
  return (
    <span
      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ color: s.color, background: s.bg }}
    >
      <Icon size={10} />
      {s.label}
    </span>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const color = priority === 'high' ? '#f85149' : priority === 'medium' ? '#d29922' : '#8b949e';
  return <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} title={`Priority: ${priority}`} />;
}

// Slide-over panel showing session chat history for a task
function SessionOutputPanel({
  story,
  onClose,
}: {
  story: Story;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-2xl h-full flex flex-col border-l shadow-2xl"
        style={{ background: '#0d1117', borderColor: '#30363d' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ background: '#161b22', borderColor: '#30363d' }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-mono" style={{ color: '#8b949e' }}>{story.storyId}</span>
              <StatusChip status={story.status} />
            </div>
            <p className="text-sm font-semibold truncate" style={{ color: '#e6edf3' }}>{story.title}</p>
            {story.sessionKey && (
              <p className="text-xs font-mono mt-0.5" style={{ color: '#8b949e' }}>
                Session: {story.sessionKey}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 ml-3">
            {story.sessionKey && (
              <a
                href={`/agents/${story.sessionKey.split(':')[0]}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                style={{ color: '#8b949e', border: '1px solid #30363d' }}
              >
                <ExternalLink size={11} />
                Open
              </a>
            )}
            <button onClick={onClose} style={{ color: '#8b949e' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Description */}
        {story.description && (
          <div className="px-5 py-3 border-b flex-shrink-0" style={{ borderColor: '#30363d', background: '#161b22' }}>
            <p className="text-xs" style={{ color: '#8b949e' }}>Task instructions</p>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: '#e6edf3' }}>{story.description}</p>
          </div>
        )}

        {/* Chat history or empty state */}
        <div className="flex-1 overflow-hidden">
          {story.sessionKey ? (
            <ChatPanel sessionKey={story.sessionKey} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <MessageSquare size={32} style={{ color: '#30363d' }} />
              <p className="text-sm" style={{ color: '#8b949e' }}>No session linked to this task</p>
              <p className="text-xs" style={{ color: '#484f58' }}>Dispatch this task from the Board view to link a session</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HistoryPanel() {
  const { data: allStories = [], isLoading, refetch } = trpc.projects.stories.history.useQuery(
    { limit: 100 },
    { refetchInterval: 15000 }
  );
  const { data: allProjects = [] } = trpc.projects.list.useQuery();
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const projectMap = new Map((allProjects as Project[]).map(p => [p.id, p]));

  const filtered = (allStories as Story[]).filter(s => {
    if (filter === 'all') return true;
    if (filter === 'dispatched') return !!s.sessionKey;
    return s.status === filter;
  });

  const filterOptions = [
    { id: 'all', label: 'All' },
    { id: 'dispatched', label: 'Dispatched' },
    { id: 'in_progress', label: 'Running' },
    { id: 'done', label: 'Done' },
    { id: 'todo', label: 'TODO' },
    { id: 'blocked', label: 'Blocked' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: '#e6edf3' }}>Task History</h1>
          <p className="text-xs mt-0.5" style={{ color: '#8b949e' }}>
            {filtered.length} task{filtered.length !== 1 ? 's' : ''} · sorted by last updated
          </p>
        </div>
        {/* Filter chips */}
        <div className="flex items-center gap-1">
          {filterOptions.map(opt => (
            <button
              key={opt.id}
              onClick={() => setFilter(opt.id)}
              className="text-xs px-2.5 py-1 rounded-md transition-colors"
              style={{
                background: filter === opt.id ? '#21262d' : 'transparent',
                color: filter === opt.id ? '#e6edf3' : '#8b949e',
                border: filter === opt.id ? '1px solid #30363d' : '1px solid transparent',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {isLoading && (
          <div className="space-y-2">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-16 rounded-lg animate-pulse" style={{ background: '#161b22' }} />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Clock size={32} style={{ color: '#30363d' }} />
            <p className="text-sm" style={{ color: '#8b949e' }}>No tasks found</p>
          </div>
        )}

        {!isLoading && filtered.map(story => {
          const project = story.projectId ? projectMap.get(story.projectId) : undefined;
          return (
            <button
              key={story.id}
              onClick={() => setSelectedStory(story as Story)}
              className="w-full text-left rounded-lg border p-3 transition-all flex items-center gap-3"
              style={{ background: '#161b22', borderColor: '#30363d' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#58a6ff40'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#30363d'; }}
            >
              {/* Priority */}
              <PriorityDot priority={story.priority} />

              {/* Main content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-mono" style={{ color: '#8b949e' }}>{story.storyId}</span>
                  {project && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-sm font-medium"
                      style={{ background: project.color + '20', color: project.color, border: `1px solid ${project.color}30` }}
                    >
                      {project.name}
                    </span>
                  )}
                </div>
                <p className="text-sm truncate" style={{ color: '#e6edf3' }}>{story.title}</p>
                {story.assignedAgent && (
                  <p className="text-xs mt-0.5" style={{ color: '#8b949e' }}>@ {story.assignedAgent}</p>
                )}
              </div>

              {/* Right side */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <StatusChip status={story.status} />
                {story.sessionKey && (
                  <span
                    className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-sm"
                    style={{ background: 'rgba(88,166,255,0.12)', color: '#58a6ff', border: '1px solid rgba(88,166,255,0.2)' }}
                  >
                    <MessageSquare size={9} />
                    output
                  </span>
                )}
                <span className="text-xs" style={{ color: '#484f58' }}>{formatDate(story.updatedAt)}</span>
                <ChevronRight size={14} style={{ color: '#30363d' }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Session output slide-over */}
      {selectedStory && (
        <SessionOutputPanel
          story={selectedStory}
          onClose={() => setSelectedStory(null)}
        />
      )}
    </div>
  );
}
