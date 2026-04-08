'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { trpc } from '@/lib/trpc';
import {
  Plus, AlertTriangle, X, GripVertical,
  Play, ExternalLink, CircleDot, CheckCircle2, Unlink, ChevronDown
} from 'lucide-react';

type Status = 'todo' | 'in_progress' | 'blocked' | 'done';

type Story = {
  id: string;
  projectId: string | null;
  storyId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignedAgent: string | null;
  blockedReason: string | null;
  labels: string;
  position: number;
  sessionKey: string | null;
  dispatchedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type Project = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type AgentSession = {
  key: string;
  label?: string;
  model?: string;
  updatedAt?: number;
};

const COLUMNS: { id: Status; label: string; color: string }[] = [
  { id: 'todo', label: 'TODO', color: '#8b949e' },
  { id: 'in_progress', label: 'IN PROGRESS', color: '#58a6ff' },
  { id: 'blocked', label: 'BLOCKED', color: '#f85149' },
  { id: 'done', label: 'DONE', color: '#3fb950' },
];

function getPriorityColor(priority: string) {
  if (priority === 'high') return '#f85149';
  if (priority === 'medium') return '#d29922';
  return '#8b949e';
}

function SessionBadge({ sessionKey, onClick }: { sessionKey: string; onClick: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-sm transition-all"
      style={{ background: 'rgba(88,166,255,0.12)', color: '#58a6ff', border: '1px solid rgba(88,166,255,0.25)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(88,166,255,0.2)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(88,166,255,0.12)'; }}
      title={`Session: ${sessionKey}`}
    >
      <CircleDot size={9} className="animate-pulse" />
      <span className="font-mono" style={{ fontSize: '10px' }}>{sessionKey.split(':').slice(-2).join(':')}</span>
      <ExternalLink size={8} />
    </button>
  );
}

function StoryCard({
  story,
  project,
  onClick,
  isDragging,
  onViewSession,
}: {
  story: Story;
  project?: Project;
  onClick?: () => void;
  isDragging?: boolean;
  onViewSession: (key: string) => void;
}) {
  const labels = (() => {
    try { return JSON.parse(story.labels) as string[]; } catch { return []; }
  })();

  return (
    <div
      onClick={onClick}
      className="rounded-md border p-3 cursor-pointer transition-all"
      style={{
        background: isDragging ? '#21262d' : '#0d1117',
        borderColor: story.status === 'blocked' ? 'rgba(248,81,73,0.4)' : story.sessionKey ? 'rgba(88,166,255,0.3)' : '#30363d',
        opacity: isDragging ? 0.5 : 1,
      }}
      onMouseEnter={e => {
        if (!isDragging) (e.currentTarget as HTMLElement).style.borderColor = '#58a6ff60';
      }}
      onMouseLeave={e => {
        if (!isDragging) (e.currentTarget as HTMLElement).style.borderColor =
          story.status === 'blocked' ? 'rgba(248,81,73,0.4)' : story.sessionKey ? 'rgba(88,166,255,0.3)' : '#30363d';
      }}
    >
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          {/* Story ID + project chip */}
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className="text-xs font-mono" style={{ color: '#8b949e' }}>{story.storyId}</span>
            {project && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-sm font-medium"
                style={{
                  background: project.color + '25',
                  color: project.color,
                  border: `1px solid ${project.color}40`,
                }}
              >
                {project.name}
              </span>
            )}
            {story.status === 'blocked' && (
              <span
                className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-sm"
                style={{ background: 'rgba(248,81,73,0.15)', color: '#f85149' }}
              >
                <AlertTriangle size={10} />
                Blocked
              </span>
            )}
          </div>
          <p className="text-sm leading-snug" style={{ color: '#e6edf3' }}>{story.title}</p>
        </div>
        {/* Priority dot */}
        <div
          className="shrink-0 w-2 h-2 rounded-full mt-1"
          style={{ background: getPriorityColor(story.priority) }}
          title={`Priority: ${story.priority}`}
        />
      </div>

      {/* Labels */}
      {labels.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-2">
          {labels.map(l => (
            <span
              key={l}
              className="text-xs px-1.5 py-0.5 rounded-sm"
              style={{ background: '#21262d', color: '#8b949e', border: '1px solid #30363d' }}
            >
              {l}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-2 gap-2">
        {story.assignedAgent && (
          <p className="text-xs" style={{ color: '#8b949e' }}>
            @ {story.assignedAgent}
          </p>
        )}
        {story.sessionKey && (
          <SessionBadge sessionKey={story.sessionKey} onClick={() => onViewSession(story.sessionKey!)} />
        )}
      </div>
    </div>
  );
}

function SortableCard({
  story,
  project,
  onClick,
  onViewSession,
}: {
  story: Story;
  project?: Project;
  onClick: () => void;
  onViewSession: (key: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: story.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="flex gap-1 items-start">
        <button
          {...listeners}
          className="mt-3 shrink-0 cursor-grab active:cursor-grabbing"
          style={{ color: '#30363d' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#8b949e')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#30363d')}
        >
          <GripVertical size={14} />
        </button>
        <div className="flex-1">
          <StoryCard story={story} project={project} onClick={onClick} isDragging={isDragging} onViewSession={onViewSession} />
        </div>
      </div>
    </div>
  );
}

// Dispatch modal — pick a session and send the task
function DispatchModal({
  story,
  sessions,
  onClose,
  onDispatched,
}: {
  story: Story;
  sessions: AgentSession[];
  onClose: () => void;
  onDispatched: () => void;
}) {
  const [selectedKey, setSelectedKey] = useState(sessions[0]?.key ?? '');
  const dispatchMutation = trpc.projects.stories.dispatch.useMutation({
    onSuccess: () => { onDispatched(); onClose(); },
  });

  const inputStyle = {
    background: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '6px',
    padding: '8px 10px',
    fontSize: '13px',
    color: '#e6edf3',
    width: '100%',
    outline: 'none',
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.8)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-lg border shadow-2xl" style={{ background: '#161b22', borderColor: '#30363d' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#30363d' }}>
          <h2 className="text-sm font-semibold" style={{ color: '#e6edf3' }}>Dispatch Task</h2>
          <button onClick={onClose} style={{ color: '#8b949e' }}><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-md p-3 border" style={{ background: '#0d1117', borderColor: '#30363d' }}>
            <p className="text-xs mb-1" style={{ color: '#8b949e' }}>Task</p>
            <p className="text-sm font-medium" style={{ color: '#e6edf3' }}>{story.title}</p>
            {story.description && (
              <p className="text-xs mt-1 leading-relaxed" style={{ color: '#8b949e' }}>{story.description}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#8b949e' }}>Send to session</label>
            {sessions.length > 0 ? (
              <select
                style={inputStyle}
                value={selectedKey}
                onChange={e => setSelectedKey(e.target.value)}
              >
                {sessions.map(s => (
                  <option key={s.key} value={s.key}>
                    {s.label ?? s.key} {s.model ? `(${s.model.split('/').pop()})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-xs py-2" style={{ color: '#f85149' }}>No active sessions found. Start an agent first.</div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-md border" style={{ color: '#8b949e', borderColor: '#30363d' }}>
              Cancel
            </button>
            <button
              disabled={!selectedKey || dispatchMutation.isPending}
              onClick={() => dispatchMutation.mutate({ id: story.id, sessionKey: selectedKey })}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium disabled:opacity-50"
              style={{ background: '#3fb950', color: '#0d1117' }}
            >
              <Play size={12} />
              {dispatchMutation.isPending ? 'Sending...' : 'Dispatch'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Story edit/create dialog
function StoryDialog({
  story,
  projects,
  sessions,
  defaultStatus,
  onClose,
  onSave,
}: {
  story?: Story | null;
  projects: Project[];
  sessions: AgentSession[];
  defaultStatus?: Status;
  onClose: () => void;
  onSave: () => void;
}) {
  const isNew = !story;
  const createMutation = trpc.projects.stories.create.useMutation({ onSuccess: onSave });
  const updateMutation = trpc.projects.stories.update.useMutation({ onSuccess: onSave });
  const deleteMutation = trpc.projects.stories.delete.useMutation({ onSuccess: onSave });
  const undispatchMutation = trpc.projects.stories.undispatch.useMutation({ onSuccess: onSave });

  const [showDispatch, setShowDispatch] = useState(false);
  const [form, setForm] = useState({
    storyId: story?.storyId || '',
    title: story?.title || '',
    description: story?.description || '',
    status: (story?.status || defaultStatus || 'todo') as Status,
    priority: (story?.priority || 'medium') as 'low' | 'medium' | 'high',
    projectId: story?.projectId || '',
    assignedAgent: story?.assignedAgent || '',
    blockedReason: story?.blockedReason || '',
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      storyId: form.storyId,
      title: form.title,
      description: form.description || undefined,
      status: form.status,
      priority: form.priority,
      projectId: form.projectId || undefined,
      assignedAgent: form.assignedAgent || undefined,
      blockedReason: form.blockedReason || undefined,
      labels: [],
      position: story?.position || Date.now(),
    };
    if (isNew) {
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate({ id: story!.id, ...payload });
    }
  }

  const inputStyle = {
    background: '#0d1117',
    borderColor: '#30363d',
    color: '#e6edf3',
    border: '1px solid #30363d',
    borderRadius: '6px',
    padding: '8px 10px',
    fontSize: '13px',
    width: '100%',
    outline: 'none',
  };

  const labelStyle = { color: '#8b949e', fontSize: '12px', fontWeight: 500 as const, display: 'block' as const, marginBottom: '4px' };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.7)' }}
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <div className="w-full max-w-lg rounded-lg border shadow-2xl" style={{ background: '#161b22', borderColor: '#30363d' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#30363d' }}>
            <h2 className="text-sm font-semibold" style={{ color: '#e6edf3' }}>
              {isNew ? 'New Task' : 'Edit Task'}
            </h2>
            <button onClick={onClose} style={{ color: '#8b949e' }}><X size={16} /></button>
          </div>

          {/* Session badge if dispatched */}
          {!isNew && story?.sessionKey && (
            <div className="px-5 py-2 border-b flex items-center justify-between" style={{ borderColor: '#30363d', background: 'rgba(88,166,255,0.05)' }}>
              <div className="flex items-center gap-2">
                <CircleDot size={12} style={{ color: '#58a6ff' }} className="animate-pulse" />
                <span className="text-xs" style={{ color: '#58a6ff' }}>Dispatched to <span className="font-mono">{story.sessionKey}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/agents/${story.sessionKey.split(':')[0]}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs"
                  style={{ color: '#8b949e' }}
                  onClick={e => e.stopPropagation()}
                >
                  View output <ExternalLink size={10} />
                </a>
                <button
                  onClick={() => undispatchMutation.mutate({ id: story!.id })}
                  className="flex items-center gap-1 text-xs"
                  style={{ color: '#8b949e' }}
                >
                  <Unlink size={10} /> Unlink
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Task ID</label>
                <input
                  style={inputStyle}
                  value={form.storyId}
                  onChange={e => setForm(f => ({ ...f, storyId: e.target.value }))}
                  placeholder="US-001"
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>Project</label>
                <select style={inputStyle} value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}>
                  <option value="">No project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Title</label>
              <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title..." required />
            </div>

            <div>
              <label style={labelStyle}>Description / Instructions</label>
              <textarea
                style={{ ...inputStyle, resize: 'vertical', minHeight: '90px' }}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What should the agent do? Be specific..."
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label style={labelStyle}>Status</label>
                <select style={inputStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Status }))}>
                  <option value="todo">TODO</option>
                  <option value="in_progress">In Progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Priority</label>
                <select style={inputStyle} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as 'low' | 'medium' | 'high' }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Agent</label>
                <select style={inputStyle} value={form.assignedAgent} onChange={e => setForm(f => ({ ...f, assignedAgent: e.target.value }))}>
                  <option value="">Unassigned</option>
                  {sessions.map(s => (
                    <option key={s.key} value={s.label ?? s.key.split(':')[0]}>
                      {s.label ?? s.key.split(':')[0]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {form.status === 'blocked' && (
              <div>
                <label style={labelStyle}>Blocked Reason</label>
                <input style={inputStyle} value={form.blockedReason} onChange={e => setForm(f => ({ ...f, blockedReason: e.target.value }))} placeholder="Why is this blocked?" />
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              {!isNew && (
                <button type="button" onClick={() => deleteMutation.mutate({ id: story!.id })} className="text-xs px-3 py-1.5 rounded-md border" style={{ color: '#f85149', borderColor: 'rgba(248,81,73,0.3)' }}>
                  Delete
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button type="button" onClick={onClose} className="text-xs px-3 py-1.5 rounded-md border" style={{ color: '#8b949e', borderColor: '#30363d' }}>
                  Cancel
                </button>
                <button type="submit" className="text-xs px-3 py-1.5 rounded-md font-medium" style={{ background: '#58a6ff', color: '#0d1117' }}>
                  {isNew ? 'Create' : 'Save'}
                </button>
                {!isNew && !story?.sessionKey && (
                  <button
                    type="button"
                    onClick={() => setShowDispatch(true)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium"
                    style={{ background: '#3fb950', color: '#0d1117' }}
                  >
                    <Play size={11} />
                    Dispatch
                  </button>
                )}
                {!isNew && story?.sessionKey && (
                  <button
                    type="button"
                    onClick={() => setShowDispatch(true)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium"
                    style={{ background: '#21262d', color: '#58a6ff', border: '1px solid rgba(88,166,255,0.3)' }}
                  >
                    <Play size={11} />
                    Re-dispatch
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>

      {showDispatch && (
        <DispatchModal
          story={{ ...story!, storyId: form.storyId, title: form.title, description: form.description || null }}
          sessions={sessions}
          onClose={() => setShowDispatch(false)}
          onDispatched={onSave}
        />
      )}
    </>
  );
}

function DroppableColumn({
  columnId,
  children,
}: {
  columnId: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });
  return (
    <div
      ref={setNodeRef}
      className="flex-1 p-2 space-y-2 overflow-y-auto"
      style={{
        background: isOver ? 'rgba(88,166,255,0.05)' : undefined,
        transition: 'background 0.2s',
      }}
    >
      {children}
    </div>
  );
}

export default function KanbanBoard() {
  const { data: allStories = [], refetch: refetchStories } = trpc.projects.stories.list.useQuery(undefined, { refetchInterval: 15000 });
  const { data: allProjects = [] } = trpc.projects.list.useQuery();
  const { data: sessionsData } = trpc.sessions.list.useQuery(undefined, { refetchInterval: 15000 });
  const updateStory = trpc.projects.stories.update.useMutation({ onSuccess: () => refetchStories() });

  const sessions: AgentSession[] = sessionsData?.sessions ?? [];

  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [dialogStory, setDialogStory] = useState<Story | null | undefined>(undefined);
  const [dialogStatus, setDialogStatus] = useState<Status>('todo');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const projectById = useCallback(
    (id: string | null) => allProjects.find(p => p.id === id),
    [allProjects]
  );

  function storiesInColumn(status: Status) {
    return (allStories as Story[])
      .filter(s => s.status === status)
      .sort((a, b) => a.position - b.position);
  }

  function handleDragStart(event: DragStartEvent) {
    const story = (allStories as Story[]).find(s => s.id === event.active.id);
    setActiveStory(story || null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveStory(null);
    const { active, over } = event;
    if (!over) return;
    const overId = String(over.id);
    const targetStatus = COLUMNS.find(c => c.id === overId)?.id
      || (allStories as Story[]).find(s => s.id === overId)?.status as Status | undefined;
    if (!targetStatus) return;
    const story = (allStories as Story[]).find(s => s.id === active.id);
    if (!story || story.status === targetStatus) return;
    await updateStory.mutateAsync({ id: story.id, status: targetStatus });
    refetchStories();
  }

  function handleViewSession(sessionKey: string) {
    const agentId = sessionKey.split(':')[0];
    window.open(`/agents/${agentId}`, '_blank');
  }

  const isDialogOpen = dialogStory !== undefined;

  return (
    <div className="h-full flex flex-col">
      {/* Board header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: '#e6edf3' }}>Task Board</h1>
          <p className="text-xs mt-0.5" style={{ color: '#8b949e' }}>
            {(allStories as Story[]).length} tasks · {sessions.length} active session{sessions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => { setDialogStory(null); setDialogStatus('todo'); }}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md font-medium"
          style={{ background: '#58a6ff', color: '#0d1117' }}
        >
          <Plus size={14} />
          New Task
        </button>
      </div>

      {/* Kanban columns */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 flex-1 overflow-x-auto pb-4">
          {COLUMNS.map(col => {
            const colStories = storiesInColumn(col.id);
            return (
              <div
                key={col.id}
                className="flex flex-col rounded-lg border min-w-[260px] w-[260px] shrink-0"
                style={{ background: '#161b22', borderColor: '#30363d' }}
                id={col.id}
              >
                <div className="flex items-center justify-between px-3 py-3 border-b" style={{ borderColor: '#30363d' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                    <span className="text-xs font-semibold tracking-wider" style={{ color: col.color }}>{col.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-mono" style={{ background: '#21262d', color: '#8b949e' }}>
                      {colStories.length}
                    </span>
                    <button
                      onClick={() => { setDialogStory(null); setDialogStatus(col.id); }}
                      style={{ color: '#30363d' }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#8b949e')}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#30363d')}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                <DroppableColumn columnId={col.id}>
                  <SortableContext items={colStories.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    {colStories.map(story => (
                      <SortableCard
                        key={story.id}
                        story={story as Story}
                        project={projectById(story.projectId)}
                        onClick={() => setDialogStory(story as Story)}
                        onViewSession={handleViewSession}
                      />
                    ))}
                  </SortableContext>
                  {colStories.length === 0 && (
                    <div className="flex items-center justify-center py-8 rounded-md border border-dashed text-xs" style={{ borderColor: '#30363d', color: '#30363d' }}>
                      Drop here
                    </div>
                  )}
                </DroppableColumn>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeStory && (
            <div className="rotate-2 opacity-90">
              <StoryCard story={activeStory} project={projectById(activeStory.projectId)} isDragging onViewSession={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {isDialogOpen && (
        <StoryDialog
          story={dialogStory}
          projects={allProjects as Project[]}
          sessions={sessions}
          defaultStatus={dialogStatus}
          onClose={() => setDialogStory(undefined)}
          onSave={() => { setDialogStory(undefined); refetchStories(); }}
        />
      )}
    </div>
  );
}
