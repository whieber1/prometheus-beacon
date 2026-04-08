"use client";

import type { WSStatus } from "@/hooks/useWebSocket";

const STATUS_MAP: Record<WSStatus, { label: string; color: string; pulse: boolean }> = {
  connected: { label: "LIVE", color: "var(--success)", pulse: true },
  connecting: { label: "CONNECTING", color: "var(--warning)", pulse: true },
  reconnecting: { label: "RECONNECTING", color: "var(--warning)", pulse: true },
  disconnected: { label: "OFFLINE", color: "var(--error)", pulse: false },
};

export function ConnectionStatus({ status }: { status: WSStatus }) {
  const s = STATUS_MAP[status];
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-block w-2 h-2 rounded-full ${s.pulse ? "animate-pulse-dot" : ""}`}
        style={{ backgroundColor: s.color }}
      />
      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: s.color }}>
        {s.label}
      </span>
    </div>
  );
}
