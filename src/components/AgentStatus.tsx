"use client";

import { Panel } from "@/components/ui/Panel";
import type { AgentStatus as AgentStatusType, ProfileInfo } from "@/lib/types";
import type { WSStatus } from "@/hooks/useWebSocket";

interface AgentStatusProps {
  status: AgentStatusType | null;
  wsStatus: WSStatus;
  profiles: ProfileInfo[];
}

const STATE_STYLES: Record<string, { color: string; icon: string }> = {
  idle: { color: "var(--text-muted)", icon: "○" },
  thinking: { color: "var(--warning)", icon: "◉" },
  running: { color: "var(--success)", icon: "●" },
  dreaming: { color: "var(--accent)", icon: "◐" },
  errored: { color: "var(--error)", icon: "✕" },
};

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function AgentStatus({ status, wsStatus, profiles }: AgentStatusProps) {
  const st = status?.state || "idle";
  const style = STATE_STYLES[st] || STATE_STYLES.idle;
  const activeProfile = profiles.find((p) => p.is_active);

  return (
    <Panel
      title="Agent"
      badge={st.toUpperCase()}
      badgeColor={style.color}
    >
      <div className="p-3 space-y-3 text-sm">
        {/* State indicator */}
        <div className="flex items-center gap-3">
          <span
            className={`text-2xl ${st === "thinking" || st === "dreaming" ? "animate-pulse-dot" : ""}`}
            style={{ color: style.color }}
          >
            {style.icon}
          </span>
          <div>
            <div className="font-semibold text-text-primary capitalize">{st}</div>
            <div className="text-xs text-text-muted">
              {wsStatus === "connected" ? "WebSocket connected" : `WS: ${wsStatus}`}
            </div>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-2">
          <InfoRow label="Model" value={status?.model || "—"} />
          <InfoRow label="Provider" value={status?.provider || "—"} />
          <InfoRow label="Profile" value={activeProfile?.name || status?.profile || "—"} />
          <InfoRow label="Uptime" value={status ? formatUptime(status.uptime_seconds) : "—"} />
        </div>

        {/* Profiles list */}
        {profiles.length > 0 && (
          <div>
            <div className="text-[10px] font-bold uppercase text-text-muted tracking-wider mb-1">
              Profiles
            </div>
            <div className="flex flex-wrap gap-1">
              {profiles.map((p) => (
                <span
                  key={p.name}
                  className={`px-2 py-0.5 text-xs rounded-full border ${
                    p.is_active
                      ? "border-accent text-accent bg-accent/10"
                      : "border-border text-text-muted"
                  }`}
                >
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-input rounded px-2 py-1.5">
      <div className="text-[10px] font-bold uppercase text-text-muted tracking-wider">{label}</div>
      <div className="text-text-primary font-mono text-xs truncate" title={value}>
        {value}
      </div>
    </div>
  );
}
