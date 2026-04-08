'use client';

import { useState, useEffect } from 'react';
import { Bot, Cpu, Clock, Zap, Circle, RefreshCw } from 'lucide-react';
import { useGatewayStore } from '@/lib/stores/gateway-store';
import type { PrometheusProfile } from '@/server/gateway/types';

function formatUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const STATE_COLORS: Record<string, string> = {
  idle: '#8b949e',
  thinking: '#d29922',
  running: '#3fb950',
  dreaming: '#bc8cff',
  errored: '#f85149',
};

export default function AgentsPage() {
  const status = useGatewayStore(s => s.prometheusStatus);
  const profiles = useGatewayStore(s => s.profiles);
  const sentinel = useGatewayStore(s => s.sentinelState);
  const lcm = useGatewayStore(s => s.lcmState);
  const connectionState = useGatewayStore(s => s.connectionState);
  const { setProfiles, setPrometheusStatus } = useGatewayStore();
  const [loading, setLoading] = useState(false);

  // Fetch profiles + status from Prometheus REST
  useEffect(() => {
    const base = typeof window !== 'undefined' ? `http://${window.location.hostname}:8005` : '';
    Promise.all([
      fetch(`${base}/api/profiles`).then(r => r.ok ? r.json() : []),
      fetch(`${base}/api/status`).then(r => r.ok ? r.json() : null),
      fetch(`${base}/api/sentinel`).then(r => r.ok ? r.json() : null),
    ]).then(([profs, stat, sent]) => {
      if (profs) setProfiles(profs);
      if (stat) setPrometheusStatus(stat);
    }).catch(() => {});
  }, [setProfiles, setPrometheusStatus]);

  const stateColor = STATE_COLORS[status?.state ?? 'idle'] ?? '#8b949e';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-3 border-b flex-shrink-0"
        style={{ background: '#161b22', borderColor: '#30363d' }}
      >
        <div>
          <h1 className="text-base font-semibold" style={{ color: '#e6edf3' }}>Agent Status</h1>
          <p className="text-xs" style={{ color: '#8b949e' }}>
            Prometheus agent harness — {connectionState === 'connected' ? 'live' : connectionState}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Status card */}
        <div
          className="rounded-xl p-6 border"
          style={{ background: '#161b22', borderColor: '#30363d' }}
        >
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: `${stateColor}20` }}>
              <Bot size={28} style={{ color: stateColor }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold" style={{ color: '#e6edf3' }}>Prometheus</h2>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-semibold uppercase"
                  style={{ background: `${stateColor}20`, color: stateColor }}
                >
                  {status?.state ?? 'offline'}
                </span>
              </div>
              <p className="text-sm mt-0.5" style={{ color: '#8b949e' }}>
                {status?.model ?? 'No model detected'} · {status?.provider ?? '—'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfoCard label="Model" value={status?.model ?? '—'} icon={<Cpu size={12} />} />
            <InfoCard label="Provider" value={status?.provider ?? '—'} icon={<Zap size={12} />} />
            <InfoCard label="Profile" value={status?.profile ?? '—'} icon={<Bot size={12} />} />
            <InfoCard label="Uptime" value={status ? formatUptime(status.uptime_seconds) : '—'} icon={<Clock size={12} />} />
          </div>
        </div>

        {/* Profiles */}
        {profiles.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wider mb-3 px-1" style={{ color: '#8b949e' }}>
              Available Profiles
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {profiles.map(p => (
                <div
                  key={p.name}
                  className="rounded-lg border p-4 transition-colors"
                  style={{
                    background: '#161b22',
                    borderColor: p.is_active ? '#58a6ff' : '#30363d',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Circle size={8} fill={p.is_active ? '#58a6ff' : 'transparent'} stroke={p.is_active ? '#58a6ff' : '#8b949e'} strokeWidth={2} />
                    <span className="text-sm font-semibold font-mono" style={{ color: '#e6edf3' }}>{p.name}</span>
                    {p.is_active && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#58a6ff20', color: '#58a6ff' }}>
                        active
                      </span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: '#8b949e' }}>{p.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Context summary */}
        {lcm && (
          <div
            className="rounded-xl p-4 border"
            style={{ background: '#161b22', borderColor: '#30363d' }}
          >
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: '#8b949e' }}>Context Window</p>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 rounded-full overflow-hidden" style={{ background: '#30363d', height: 8 }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (lcm.total_tokens / lcm.limit) * 100)}%`,
                    background: (lcm.total_tokens / lcm.limit) > 0.8 ? '#f85149' : '#d2a8ff',
                  }}
                />
              </div>
              <span className="text-xs font-mono" style={{ color: '#8b949e' }}>
                {Math.round((lcm.total_tokens / lcm.limit) * 100)}%
              </span>
            </div>
            <div className="flex gap-4 text-xs" style={{ color: '#8b949e' }}>
              <span>{lcm.total_tokens.toLocaleString()} tokens</span>
              <span>{lcm.fresh_count} fresh</span>
              <span>{lcm.summary_count} summaries</span>
              {lcm.compression_ratio > 0 && <span>{lcm.compression_ratio.toFixed(1)}x compression</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg p-3" style={{ background: '#0d1117', border: '1px solid #21262d' }}>
      <div className="flex items-center gap-1.5 mb-1">
        <span style={{ color: '#8b949e' }}>{icon}</span>
        <span className="text-xs uppercase tracking-wide" style={{ color: '#6e7681' }}>{label}</span>
      </div>
      <p className="text-sm font-mono truncate" style={{ color: '#e6edf3' }}>{value}</p>
    </div>
  );
}
