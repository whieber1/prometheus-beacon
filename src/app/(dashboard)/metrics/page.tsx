'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Cpu, Zap, MessageSquare, Activity, Server, Clock } from 'lucide-react';
import { useGatewayStore } from '@/lib/stores/gateway-store';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatBytes(b: number): string {
  if (b <= 0) return '—';
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(0)} MB`;
  return `${(b / 1024).toFixed(0)} KB`;
}

function formatUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function modelShortName(model: string): string {
  return model
    .replace('anthropic/', '')
    .replace('ollama/', '')
    .replace('-instruct', '')
    .replace('-q4_K_M', '');
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, color = '#58a6ff',
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2"
      style={{ background: '#161b22', border: '1px solid #30363d' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide" style={{ color: '#6e7681' }}>{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-bold font-mono" style={{ color: '#e6edf3' }}>{value}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: '#8b949e' }}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, color = '#58a6ff', label }: { value: number; color?: string; label?: string }) {
  const pct = Math.min(100, Math.max(0, value));
  const barColor = pct > 80 ? '#f85149' : pct > 60 ? '#e3b341' : color;
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs flex-shrink-0" style={{ color: '#8b949e', minWidth: 32 }}>{label}</span>}
      <div className="flex-1 rounded-full overflow-hidden" style={{ background: '#30363d', height: 6 }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      <span className="text-xs font-mono flex-shrink-0" style={{ color: '#8b949e', minWidth: 32, textAlign: 'right' }}>
        {pct}%
      </span>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span style={{ color: '#58a6ff' }}>{icon}</span>
      <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8b949e' }}>{title}</h2>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MetricsPage() {
  const telemetry = useGatewayStore(s => s.telemetry);
  const lcm = useGatewayStore(s => s.lcmState);
  const status = useGatewayStore(s => s.prometheusStatus);
  const toolCalls = useGatewayStore(s => s.toolCalls);
  const sessions = useGatewayStore(s => s.sessions);
  const [loading, setLoading] = useState(false);
  const { setTelemetry } = useGatewayStore();

  // Fetch telemetry from Prometheus REST
  const fetchTelemetry = async () => {
    setLoading(true);
    try {
      const base = typeof window !== 'undefined' ? `http://${window.location.hostname}:8005` : '';
      const res = await fetch(`${base}/api/telemetry`);
      if (res.ok) setTelemetry(await res.json());
    } catch { /* noop */ }
    setLoading(false);
  };

  // Load on mount
  useEffect(() => { fetchTelemetry(); }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div
        className="px-6 py-3 border-b flex items-center justify-between flex-shrink-0"
        style={{ background: '#161b22', borderColor: '#30363d' }}
      >
        <div>
          <h1 className="text-base font-semibold" style={{ color: '#e6edf3' }}>Metrics</h1>
          <p className="text-xs" style={{ color: '#8b949e' }}>Token usage · cost · system health</p>
        </div>
        <button
          onClick={() => { fetchTelemetry(); }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors"
          style={{ background: '#21262d', color: '#8b949e', border: '1px solid #30363d' }}
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">

        {/* ── Tool Telemetry ── */}
        <section>
          <SectionHeader icon={<Zap size={14} />} title="Tool Call Telemetry" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <StatCard
              label="Total Calls"
              value={telemetry?.total_calls ?? toolCalls.length}
              icon={<Activity size={14} />}
              color="#58a6ff"
            />
            <StatCard
              label="Success Rate"
              value={telemetry ? `${(telemetry.overall_success_rate * 100).toFixed(1)}%` : '—'}
              icon={<Zap size={14} />}
              color="#3fb950"
            />
            <StatCard
              label="Sessions"
              value={Object.keys(sessions).length}
              icon={<MessageSquare size={14} />}
              color="#d2a8ff"
            />
            <StatCard
              label="Context"
              value={lcm ? `${formatTokens(lcm.total_tokens)}` : '—'}
              sub={lcm ? `${Math.round((lcm.total_tokens / lcm.limit) * 100)}% of ${formatTokens(lcm.limit)} limit` : 'No LCM data'}
              icon={<Cpu size={14} />}
              color="#e3b341"
            />
          </div>

          {/* Per-tool table */}
          {telemetry && Object.keys(telemetry.tools).length > 0 && (
            <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid #30363d' }}>
              <div
                className="grid px-4 py-2 text-xs uppercase tracking-wide"
                style={{ background: '#161b22', borderBottom: '1px solid #30363d', color: '#6e7681',
                  gridTemplateColumns: '1fr 60px 80px 80px 80px' }}
              >
                <span>Tool</span>
                <span className="text-right">Calls</span>
                <span className="text-right">Success</span>
                <span className="text-right">Retries</span>
                <span className="text-right">Latency</span>
              </div>
              {Object.entries(telemetry.tools)
                .sort(([, a], [, b]) => b.calls - a.calls)
                .map(([name, t]) => (
                <div
                  key={name}
                  className="grid px-4 py-2.5 text-xs"
                  style={{
                    gridTemplateColumns: '1fr 60px 80px 80px 80px',
                    borderBottom: '1px solid #21262d',
                    background: '#0d1117',
                  }}
                >
                  <span className="font-mono truncate" style={{ color: '#79c0ff' }}>{name}</span>
                  <span className="text-right font-mono" style={{ color: '#8b949e' }}>{t.calls}</span>
                  <span
                    className="text-right font-mono"
                    style={{ color: t.success_rate > 0.9 ? '#3fb950' : t.success_rate > 0.7 ? '#d29922' : '#f85149' }}
                  >
                    {(t.success_rate * 100).toFixed(0)}%
                  </span>
                  <span className="text-right font-mono" style={{ color: '#8b949e' }}>{t.avg_retries.toFixed(1)}</span>
                  <span className="text-right font-mono" style={{ color: '#8b949e' }}>
                    {t.avg_latency_ms < 1000 ? `${Math.round(t.avg_latency_ms)}ms` : `${(t.avg_latency_ms / 1000).toFixed(1)}s`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Agent / Context ── */}
        <section>
          <SectionHeader icon={<Server size={14} />} title="Agent Status" />

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
            <StatCard
              label="Model"
              value={status?.model ?? 'unknown'}
              sub={status?.provider ?? '—'}
              icon={<Server size={14} />}
              color="#58a6ff"
            />
            <StatCard
              label="Uptime"
              value={status ? formatUptime(status.uptime_seconds) : '—'}
              sub={`Profile: ${status?.profile ?? '—'}`}
              icon={<Clock size={14} />}
              color="#3fb950"
            />
            <StatCard
              label="State"
              value={status?.state ?? 'offline'}
              icon={<Cpu size={14} />}
              color={status?.state === 'running' ? '#3fb950' : status?.state === 'errored' ? '#f85149' : '#e3b341'}
            />
          </div>

          {/* Context health bar */}
          {lcm && (
            <div
              className="rounded-xl p-4 space-y-4"
              style={{ background: '#161b22', border: '1px solid #30363d' }}
            >
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs" style={{ color: '#8b949e' }}>Context Window</span>
                  <span className="text-xs font-mono" style={{ color: '#e6edf3' }}>
                    {formatTokens(lcm.total_tokens)} / {formatTokens(lcm.limit)}
                  </span>
                </div>
                <ProgressBar value={Math.round((lcm.total_tokens / lcm.limit) * 100)} color="#d2a8ff" />
              </div>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <span style={{ color: '#8b949e' }}>Fresh messages</span>
                  <p className="font-mono mt-0.5" style={{ color: '#e6edf3' }}>{lcm.fresh_count}</p>
                </div>
                <div>
                  <span style={{ color: '#8b949e' }}>Summaries</span>
                  <p className="font-mono mt-0.5" style={{ color: '#e6edf3' }}>{lcm.summary_count}</p>
                </div>
                <div>
                  <span style={{ color: '#8b949e' }}>Compression</span>
                  <p className="font-mono mt-0.5" style={{ color: '#e6edf3' }}>{lcm.compression_ratio.toFixed(1)}x</p>
                </div>
              </div>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
