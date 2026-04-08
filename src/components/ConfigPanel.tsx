"use client";

import { useState } from "react";
import { Panel } from "@/components/ui/Panel";
import type {
  SkillInfo,
  TelemetryReport,
  WikiStats,
  SentinelState,
  PrometheusConfig,
} from "@/lib/types";

interface ConfigPanelProps {
  skills: SkillInfo[];
  telemetry: TelemetryReport | null;
  wiki: WikiStats | null;
  sentinel: SentinelState | null;
  config: PrometheusConfig | null;
}

type ConfigTab = "skills" | "telemetry" | "sentinel" | "wiki" | "config";

const TABS: { id: ConfigTab; label: string }[] = [
  { id: "skills", label: "Skills" },
  { id: "telemetry", label: "Telemetry" },
  { id: "sentinel", label: "Sentinel" },
  { id: "wiki", label: "Wiki" },
  { id: "config", label: "YAML" },
];

export function ConfigPanel({ skills, telemetry, wiki, sentinel, config }: ConfigPanelProps) {
  const [tab, setTab] = useState<ConfigTab>("skills");

  return (
    <Panel title="Config">
      {/* Sub-tabs */}
      <div className="flex border-b border-border overflow-x-auto shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              tab === t.id
                ? "text-accent border-b-2 border-accent"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-auto flex-1 min-h-0">
        {tab === "skills" && <SkillsTab skills={skills} />}
        {tab === "telemetry" && <TelemetryTab telemetry={telemetry} />}
        {tab === "sentinel" && <SentinelTab sentinel={sentinel} />}
        {tab === "wiki" && <WikiTab wiki={wiki} />}
        {tab === "config" && <ConfigYamlTab config={config} />}
      </div>
    </Panel>
  );
}

function SkillsTab({ skills }: { skills: SkillInfo[] }) {
  if (skills.length === 0) {
    return <EmptyState text="No skills loaded" />;
  }
  return (
    <div className="divide-y divide-border">
      {skills.map((s) => (
        <div key={s.name} className="px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-text-primary">{s.name}</span>
            <SourceBadge source={s.source} />
          </div>
          <div className="text-xs text-text-muted mt-0.5 line-clamp-2">{s.description}</div>
        </div>
      ))}
    </div>
  );
}

function TelemetryTab({ telemetry }: { telemetry: TelemetryReport | null }) {
  if (!telemetry) return <EmptyState text="No telemetry data" />;

  const tools = Object.entries(telemetry.tools).sort(
    ([, a], [, b]) => b.calls - a.calls
  );

  return (
    <div className="p-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <MiniStat label="Total Calls" value={telemetry.total_calls} />
        <MiniStat
          label="Success Rate"
          value={`${(telemetry.overall_success_rate * 100).toFixed(1)}%`}
        />
      </div>
      {tools.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase text-text-muted tracking-wider mb-1.5">
            Per Tool
          </div>
          <div className="space-y-1">
            {tools.map(([name, t]) => (
              <div key={name} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-text-primary flex-1 truncate">{name}</span>
                <span className="text-text-muted">{t.calls}</span>
                <span
                  className="font-mono"
                  style={{
                    color:
                      t.success_rate > 0.9
                        ? "var(--success)"
                        : t.success_rate > 0.7
                        ? "var(--warning)"
                        : "var(--error)",
                  }}
                >
                  {(t.success_rate * 100).toFixed(0)}%
                </span>
                <span className="text-text-muted w-12 text-right">
                  {t.avg_latency_ms < 1000
                    ? `${Math.round(t.avg_latency_ms)}ms`
                    : `${(t.avg_latency_ms / 1000).toFixed(1)}s`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SentinelTab({ sentinel }: { sentinel: SentinelState | null }) {
  if (!sentinel) return <EmptyState text="SENTINEL not connected" />;

  return (
    <div className="p-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <MiniStat label="State" value={sentinel.state} />
        <MiniStat label="Dreams" value={sentinel.dream_count} />
        <MiniStat
          label="Last Dream"
          value={sentinel.last_dream ? new Date(sentinel.last_dream * 1000).toLocaleTimeString() : "—"}
        />
        <MiniStat
          label="Idle Since"
          value={sentinel.idle_since ? new Date(sentinel.idle_since * 1000).toLocaleTimeString() : "—"}
        />
      </div>

      {sentinel.dream_log_tail.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase text-text-muted tracking-wider mb-1.5">
            Recent Dreams
          </div>
          <div className="space-y-2">
            {sentinel.dream_log_tail.map((d) => (
              <div key={d.cycle} className="bg-bg-input rounded p-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-accent font-semibold">Cycle #{d.cycle}</span>
                  <span className="text-text-muted">
                    {new Date(d.timestamp * 1000).toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {d.phases.map((p) => (
                    <span
                      key={p.phase}
                      className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                      style={{
                        backgroundColor:
                          p.status === "ok"
                            ? "var(--success)"
                            : p.status === "error"
                            ? "var(--error)"
                            : "var(--text-muted)",
                        color: "#fff",
                        opacity: p.status === "skipped" ? 0.5 : 1,
                      }}
                    >
                      {p.phase} ({p.duration_seconds.toFixed(1)}s)
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WikiTab({ wiki }: { wiki: WikiStats | null }) {
  if (!wiki) return <EmptyState text="Wiki not connected" />;

  const entities = Object.entries(wiki.entity_counts).sort(([, a], [, b]) => b - a);

  return (
    <div className="p-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <MiniStat label="Total Pages" value={wiki.page_count} />
        <MiniStat
          label="Last Compiled"
          value={
            wiki.last_compiled
              ? new Date(wiki.last_compiled * 1000).toLocaleDateString()
              : "—"
          }
        />
      </div>
      {entities.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase text-text-muted tracking-wider mb-1.5">
            Entity Breakdown
          </div>
          <div className="space-y-1">
            {entities.map(([type, count]) => (
              <div key={type} className="flex items-center justify-between text-xs">
                <span className="text-text-secondary capitalize">{type}</span>
                <span className="font-mono text-text-primary">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConfigYamlTab({ config }: { config: PrometheusConfig | null }) {
  if (!config) return <EmptyState text="Config not loaded" />;

  return (
    <div className="p-2">
      <pre className="text-xs font-mono text-text-secondary bg-bg-input rounded p-3 overflow-auto max-h-[400px] whitespace-pre-wrap">
        {config.raw_yaml}
      </pre>
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  const colors: Record<string, string> = {
    builtin: "var(--accent)",
    user: "var(--success)",
    auto: "var(--warning)",
  };
  return (
    <span
      className="text-[9px] font-bold uppercase px-1 py-0.5 rounded"
      style={{
        backgroundColor: (colors[source] || "var(--text-muted)") + "20",
        color: colors[source] || "var(--text-muted)",
      }}
    >
      {source}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-bg-input rounded px-2 py-1.5">
      <div className="text-[10px] font-bold uppercase text-text-muted tracking-wider">{label}</div>
      <div className="text-text-primary text-sm font-semibold capitalize">{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="p-4 text-center text-text-muted text-sm">{text}</div>
  );
}
