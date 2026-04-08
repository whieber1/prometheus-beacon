"use client";

import { Panel } from "@/components/ui/Panel";
import type { LCMState } from "@/lib/types";

interface ContextInspectorProps {
  lcm: LCMState | null;
}

export function ContextInspector({ lcm }: ContextInspectorProps) {
  if (!lcm) {
    return (
      <Panel title="Context">
        <div className="p-4 text-center text-text-muted text-sm">
          No context data — waiting for LCM update
        </div>
      </Panel>
    );
  }

  const pct = lcm.limit > 0 ? (lcm.total_tokens / lcm.limit) * 100 : 0;
  const barColor =
    pct > 90 ? "var(--error)" : pct > 70 ? "var(--warning)" : "var(--accent)";

  return (
    <Panel title="Context" badge={`${Math.round(pct)}%`} badgeColor={barColor}>
      <div className="p-3 space-y-3">
        {/* Token usage bar */}
        <div>
          <div className="flex justify-between text-xs text-text-muted mb-1">
            <span>{lcm.total_tokens.toLocaleString()} tokens</span>
            <span>{lcm.limit.toLocaleString()} limit</span>
          </div>
          <div className="h-3 bg-bg-input rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }}
            />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          <StatBox label="Fresh Messages" value={lcm.fresh_count} />
          <StatBox label="Summaries" value={lcm.summary_count} />
          <StatBox
            label="Compression"
            value={lcm.compression_ratio > 0 ? `${lcm.compression_ratio.toFixed(1)}x` : "—"}
          />
          <StatBox label="Session" value={lcm.session_id.slice(0, 8) + "..."} mono />
        </div>

        {/* Visual indicator */}
        <div className="flex items-center gap-1">
          <div className="text-[10px] font-bold uppercase text-text-muted tracking-wider">
            Context Health
          </div>
          <div className="flex-1 flex items-center gap-0.5 ml-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 h-1.5 rounded-full"
                style={{
                  backgroundColor:
                    i < Math.ceil(pct / 10) ? barColor : "var(--bg-input)",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function StatBox({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="bg-bg-input rounded px-2 py-1.5">
      <div className="text-[10px] font-bold uppercase text-text-muted tracking-wider">{label}</div>
      <div className={`text-text-primary text-sm ${mono ? "font-mono text-xs" : "font-semibold"}`}>
        {value}
      </div>
    </div>
  );
}
