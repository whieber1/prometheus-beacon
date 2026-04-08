'use client';

import { useState } from 'react';
import { Clock, Play, Trash2, Plus, CheckCircle, XCircle } from 'lucide-react';
import { api } from '@/lib/trpc';
import { Button } from '@/components/ui/button';

function formatSchedule(schedule: string): string {
  const presets: Record<string, string> = {
    '0 9 * * *': 'Daily at 9:00 AM',
    '0 0 * * 1': 'Weekly on Monday',
    '*/30 * * * *': 'Every 30 minutes',
    '0 * * * *': 'Every hour',
  };
  return presets[schedule] ?? schedule;
}

function timeAgo(ts?: number): string {
  if (!ts) return 'Never';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

interface CronCreateFormProps {
  agentId?: string;
  onCreated: () => void;
  onCancel: () => void;
}

function CronCreateForm({ agentId, onCreated, onCancel }: CronCreateFormProps) {
  const [schedule, setSchedule] = useState('0 9 * * *');
  const [task, setTask] = useState('');
  const [label, setLabel] = useState('');

  const createMutation = api.cron.add.useMutation({
    onSuccess: () => { onCreated(); },
  });

  const SCHEDULE_OPTIONS = [
    { value: '0 9 * * *', label: 'Daily at 9 AM' },
    { value: '0 0 * * 1', label: 'Weekly on Monday' },
    { value: '0 * * * *', label: 'Every hour' },
    { value: '*/30 * * * *', label: 'Every 30 minutes' },
    { value: 'custom', label: 'Custom...' },
  ];

  const [useCustom, setUseCustom] = useState(false);

  return (
    <div
      className="rounded-lg border p-4 space-y-3"
      style={{ background: '#0d1117', borderColor: '#30363d' }}
    >
      <h4 className="text-sm font-medium" style={{ color: '#e6edf3' }}>New Cron Job</h4>

      <div>
        <label className="block text-xs mb-1" style={{ color: '#8b949e' }}>Schedule</label>
        <select
          value={useCustom ? 'custom' : schedule}
          onChange={e => {
            if (e.target.value === 'custom') {
              setUseCustom(true);
            } else {
              setUseCustom(false);
              setSchedule(e.target.value);
            }
          }}
          className="w-full text-sm rounded-md px-2 py-1.5 border outline-none"
          style={{ background: '#21262d', borderColor: '#30363d', color: '#e6edf3' }}
        >
          {SCHEDULE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {useCustom && (
          <input
            type="text"
            value={schedule}
            onChange={e => setSchedule(e.target.value)}
            placeholder="0 9 * * * (cron expression)"
            className="w-full mt-1 text-sm font-mono rounded-md px-2 py-1.5 border outline-none"
            style={{ background: '#21262d', borderColor: '#30363d', color: '#e6edf3' }}
          />
        )}
      </div>

      <div>
        <label className="block text-xs mb-1" style={{ color: '#8b949e' }}>Task</label>
        <textarea
          value={task}
          onChange={e => setTask(e.target.value)}
          placeholder="What should the agent do?"
          rows={2}
          className="w-full text-sm rounded-md px-2 py-1.5 border outline-none resize-none"
          style={{ background: '#21262d', borderColor: '#30363d', color: '#e6edf3' }}
        />
      </div>

      <div>
        <label className="block text-xs mb-1" style={{ color: '#8b949e' }}>Label (optional)</label>
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="e.g. Daily standup"
          className="w-full text-sm rounded-md px-2 py-1.5 border outline-none"
          style={{ background: '#21262d', borderColor: '#30363d', color: '#e6edf3' }}
        />
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => createMutation.mutate({ agentId, schedule, task, label: label || undefined })}
          disabled={!task.trim() || createMutation.isPending}
          style={{ background: '#1f6feb', color: '#fff' }}
        >
          {createMutation.isPending ? 'Creating…' : 'Create'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} style={{ color: '#8b949e' }}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

interface CronJobManagerProps {
  agentId?: string;
}

export function CronJobManager({ agentId }: CronJobManagerProps) {
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, error, refetch } = api.cron.list.useQuery(
    { agentId },
    { refetchInterval: 30000 },
  );

  const removeMutation = api.cron.remove.useMutation({
    onSuccess: () => { void refetch(); },
  });

  const runMutation = api.cron.run.useMutation();

  const jobs = data?.jobs ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium" style={{ color: '#e6edf3' }}>Cron Jobs</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowCreate(!showCreate)}
          style={{ borderColor: '#30363d', color: '#8b949e' }}
        >
          <Plus size={12} className="mr-1" />
          Add
        </Button>
      </div>

      {showCreate && (
        <CronCreateForm
          agentId={agentId}
          onCreated={() => { setShowCreate(false); void refetch(); }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {isLoading && (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: '#21262d' }} />
          ))}
        </div>
      )}

      {error && (
        <p className="text-xs" style={{ color: '#f85149' }}>{error.message}</p>
      )}

      {!isLoading && jobs.length === 0 && !showCreate && (
        <div className="text-center py-6">
          <Clock size={24} style={{ color: '#30363d' }} className="mx-auto mb-2" />
          <p className="text-xs" style={{ color: '#8b949e' }}>No cron jobs yet</p>
        </div>
      )}

      {jobs.map(job => (
        <div
          key={job.id}
          className="rounded-lg border p-3"
          style={{ background: '#21262d', borderColor: '#30363d' }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: '#e6edf3' }}>
                {job.task}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <Clock size={10} style={{ color: '#8b949e' }} />
                <span className="text-xs font-mono" style={{ color: '#8b949e' }}>
                  {formatSchedule(job.schedule)}
                </span>
                {job.lastRunAt && (
                  <span className="text-xs" style={{ color: '#30363d' }}>
                    Last: {timeAgo(job.lastRunAt)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => runMutation.mutate({ id: job.id })}
                disabled={runMutation.isPending}
                className="p-1 rounded transition-colors hover:bg-[#30363d]"
                title="Run now"
              >
                <Play size={12} style={{ color: '#3fb950' }} />
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete cron job "${job.task}"?`)) {
                    removeMutation.mutate({ id: job.id });
                  }
                }}
                className="p-1 rounded transition-colors hover:bg-[#30363d]"
                title="Delete"
              >
                <Trash2 size={12} style={{ color: '#f85149' }} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
