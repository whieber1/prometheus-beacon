'use client';

import { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Check, AlertCircle } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Preset {
  id: string;
  name: string;
  emoji: string;
  description: string;
  capabilities: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

interface ControlLevel {
  id: 'conservative' | 'balanced' | 'autopilot';
  name: string;
  description: string;
  details: string[];
}

const PRESETS: Preset[] = [
  {
    id: 'research',
    name: 'Research Analyst',
    emoji: '🔍',
    description: 'Searches, reads, and synthesizes information from the web and files.',
    capabilities: ['Internet', 'File tools', 'Read-only'],
    riskLevel: 'low',
  },
  {
    id: 'engineer',
    name: 'Autonomous Engineer',
    emoji: '⚙️',
    description: 'Writes code, runs tests, commits, and deploys with full exec access.',
    capabilities: ['Exec', 'File tools', 'Internet', 'Sandbox'],
    riskLevel: 'high',
  },
  {
    id: 'growth',
    name: 'Growth Operator',
    emoji: '📈',
    description: 'Manages outreach, tracks metrics, and automates marketing tasks.',
    capabilities: ['Internet', 'File tools', 'Heartbeat'],
    riskLevel: 'medium',
  },
  {
    id: 'coordinator',
    name: 'Coordinator',
    emoji: '🎯',
    description: 'Spawns and orchestrates other agents to complete complex tasks.',
    capabilities: ['Subagents', 'File tools', 'Internet'],
    riskLevel: 'medium',
  },
  {
    id: 'pr',
    name: 'PR Engineer',
    emoji: '📣',
    description: 'Reviews PRs, writes documentation, and manages GitHub workflows.',
    capabilities: ['Exec', 'File tools', 'Internet'],
    riskLevel: 'medium',
  },
  {
    id: 'blank',
    name: 'Blank',
    emoji: '✨',
    description: 'Start from scratch with a fully customizable agent.',
    capabilities: [],
    riskLevel: 'low',
  },
];

const CONTROL_LEVELS: ControlLevel[] = [
  {
    id: 'conservative',
    name: 'Conservative',
    description: 'Read-only. Asks before doing anything.',
    details: ['No exec access', 'Read-only file tools', 'Approval for all writes'],
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Can execute with approval. Best for most tasks.',
    details: ['Exec with approval', 'Most tools available', 'Asks before dangerous ops'],
  },
  {
    id: 'autopilot',
    name: 'Autopilot',
    description: 'Full access. Trust but verify.',
    details: ['Full exec access', 'All tools enabled', 'Minimal interruptions'],
  },
];

const RISK_COLORS = {
  low: '#3fb950',
  medium: '#d29922',
  high: '#f85149',
};

// ─── Step 1: Preset selection ─────────────────────────────────────────────────

function StepPreset({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold" style={{ color: '#e6edf3' }}>Choose a preset</h3>
        <p className="text-sm mt-1" style={{ color: '#8b949e' }}>
          Pick a starting template for your agent.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className="text-left rounded-lg border p-3 transition-all"
            style={{
              background: selected === p.id ? '#1f2d3d' : '#21262d',
              borderColor: selected === p.id ? '#58a6ff' : '#30363d',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{p.emoji}</span>
              <span className="text-sm font-medium" style={{ color: '#e6edf3' }}>{p.name}</span>
              <span
                className="ml-auto text-xs px-1.5 py-0.5 rounded"
                style={{ background: '#0d1117', color: RISK_COLORS[p.riskLevel] }}
              >
                {p.riskLevel}
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: '#8b949e' }}>{p.description}</p>
            {p.capabilities.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {p.capabilities.map(cap => (
                  <span
                    key={cap}
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ background: '#30363d', color: '#8b949e' }}
                  >
                    {cap}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 2: Control level ────────────────────────────────────────────────────

function StepControl({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold" style={{ color: '#e6edf3' }}>Control level</h3>
        <p className="text-sm mt-1" style={{ color: '#8b949e' }}>
          How much autonomy does this agent have?
        </p>
      </div>
      <div className="space-y-3">
        {CONTROL_LEVELS.map(level => (
          <button
            key={level.id}
            onClick={() => onSelect(level.id)}
            className="w-full text-left rounded-lg border p-4 transition-all"
            style={{
              background: selected === level.id ? '#1f2d3d' : '#21262d',
              borderColor: selected === level.id ? '#58a6ff' : '#30363d',
            }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm font-medium" style={{ color: '#e6edf3' }}>{level.name}</span>
              {selected === level.id && <Check size={14} style={{ color: '#58a6ff' }} />}
            </div>
            <p className="text-xs" style={{ color: '#8b949e' }}>{level.description}</p>
            <ul className="mt-2 space-y-0.5">
              {level.details.map(d => (
                <li key={d} className="text-xs flex items-center gap-1.5" style={{ color: '#8b949e' }}>
                  <span style={{ color: '#30363d' }}>•</span> {d}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 3: Customize ────────────────────────────────────────────────────────

function StepCustomize({
  name,
  task,
  onName,
  onTask,
}: {
  name: string;
  task: string;
  onName: (v: string) => void;
  onTask: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold" style={{ color: '#e6edf3' }}>Customize</h3>
        <p className="text-sm mt-1" style={{ color: '#8b949e' }}>Give your agent a name and first task.</p>
      </div>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#8b949e' }}>
            Agent name <span style={{ color: '#f85149' }}>*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => onName(e.target.value)}
            placeholder="e.g. Atlas, Scout, Reed"
            className="w-full rounded-lg px-3 py-2 text-sm border outline-none"
            style={{
              background: '#21262d',
              borderColor: '#30363d',
              color: '#e6edf3',
            }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#8b949e' }}>
            First task (optional)
          </label>
          <textarea
            value={task}
            onChange={e => onTask(e.target.value)}
            placeholder="What should this agent do first?"
            rows={3}
            className="w-full rounded-lg px-3 py-2 text-sm border outline-none resize-none"
            style={{
              background: '#21262d',
              borderColor: '#30363d',
              color: '#e6edf3',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Review ───────────────────────────────────────────────────────────

function StepReview({
  preset,
  control,
  name,
  task,
}: {
  preset: string | null;
  control: string | null;
  name: string;
  task: string;
}) {
  const presetData = PRESETS.find(p => p.id === preset);
  const controlData = CONTROL_LEVELS.find(c => c.id === control);
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold" style={{ color: '#e6edf3' }}>Review</h3>
        <p className="text-sm mt-1" style={{ color: '#8b949e' }}>Confirm your agent configuration.</p>
      </div>
      <div
        className="rounded-lg border p-4 space-y-3"
        style={{ background: '#21262d', borderColor: '#30363d' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">{presetData?.emoji ?? '✨'}</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#e6edf3' }}>{name || '(unnamed)'}</p>
            <p className="text-xs" style={{ color: '#8b949e' }}>{presetData?.name ?? 'Blank'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#30363d', color: '#e6edf3' }}>
            {controlData?.name ?? 'Balanced'}
          </span>
          {presetData?.capabilities.map(c => (
            <span key={c} className="text-xs px-2 py-0.5 rounded" style={{ background: '#30363d', color: '#8b949e' }}>
              {c}
            </span>
          ))}
        </div>
        {task && (
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: '#8b949e' }}>First task:</p>
            <p className="text-xs" style={{ color: '#e6edf3' }}>{task}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface AgentCreateModalProps {
  open: boolean;
  onClose: () => void;
}

export function AgentCreateModal({ open, onClose }: AgentCreateModalProps) {
  const [step, setStep] = useState(0);
  const [preset, setPreset] = useState<string | null>(null);
  const [control, setControl] = useState<string | null>('balanced');
  const [name, setName] = useState('');
  const [task, setTask] = useState('');
  const [creating, setCreating] = useState(false);

  const STEP_NAMES = ['Preset', 'Control', 'Customize', 'Review'];
  const canNext = [
    !!preset,
    !!control,
    name.trim().length > 0,
    true,
  ];

  const [createError, setCreateError] = useState<string | null>(null);
  const createMutation = trpc.agents.create.useMutation({
    onSuccess: () => {
      setCreating(false);
      onClose();
      setStep(0); setPreset(null); setControl('balanced'); setName(''); setTask('');
      setCreateError(null);
      // Reload after short delay (gateway restarting)
      setTimeout(() => window.location.reload(), 3000);
    },
    onError: (err) => {
      setCreating(false);
      setCreateError(err.message);
    },
  });

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    const agentId = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    createMutation.mutate({
      id: agentId,
      name: name.trim(),
      preset: preset ?? 'blank',
      controlLevel: (control ?? 'balanced') as 'conservative' | 'balanced' | 'autopilot',
      firstTask: task.trim() || undefined,
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-xl border shadow-2xl"
        style={{ background: '#161b22', borderColor: '#30363d' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#30363d' }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: '#e6edf3' }}>Create Agent</h2>
            <div className="flex gap-1 mt-1.5">
              {STEP_NAMES.map((s, i) => (
                <div
                  key={s}
                  className="flex items-center gap-1"
                >
                  <span
                    className="text-xs"
                    style={{ color: i === step ? '#58a6ff' : i < step ? '#3fb950' : '#8b949e' }}
                  >
                    {i < step ? '✓' : s}
                  </span>
                  {i < STEP_NAMES.length - 1 && (
                    <ChevronRight size={10} style={{ color: '#30363d' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{ color: '#8b949e' }}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          {step === 0 && <StepPreset selected={preset} onSelect={setPreset} />}
          {step === 1 && <StepControl selected={control} onSelect={setControl} />}
          {step === 2 && <StepCustomize name={name} task={task} onName={setName} onTask={setTask} />}
          {step === 3 && <StepReview preset={preset} control={control} name={name} task={task} />}
        </div>

        {/* Error */}
        {createError && (
          <div className="px-5 pb-2 flex items-start gap-2">
            <AlertCircle size={14} style={{ color: '#f85149', flexShrink: 0, marginTop: 2 }} />
            <p className="text-xs" style={{ color: '#f85149' }}>{createError}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t" style={{ borderColor: '#30363d' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => step === 0 ? onClose() : setStep(step - 1)}
            style={{ color: '#8b949e' }}
          >
            {step === 0 ? (
              'Cancel'
            ) : (
              <><ChevronLeft size={14} /> Back</>
            )}
          </Button>

          {step < 3 ? (
            <Button
              size="sm"
              onClick={() => setStep(step + 1)}
              disabled={!canNext[step]}
              style={{
                background: canNext[step] ? '#1f6feb' : '#21262d',
                color: canNext[step] ? '#fff' : '#8b949e',
              }}
            >
              Next <ChevronRight size={14} />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={creating}
              style={{ background: '#1f6feb', color: '#fff' }}
            >
              {creating ? 'Creating…' : 'Create Agent'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
