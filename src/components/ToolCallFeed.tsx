"use client";

import { useState } from "react";
import { Panel } from "@/components/ui/Panel";
import type { ToolCall } from "@/lib/types";

interface ToolCallFeedProps {
  toolCalls: ToolCall[];
}

export function ToolCallFeed({ toolCalls }: ToolCallFeedProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const filtered = filter
    ? toolCalls.filter((tc) => tc.tool_name.toLowerCase().includes(filter.toLowerCase()))
    : toolCalls;

  const successCount = toolCalls.filter((tc) => tc.success === true).length;
  const failCount = toolCalls.filter((tc) => tc.success === false).length;
  const pendingCount = toolCalls.filter((tc) => tc.success === undefined).length;

  return (
    <Panel
      title="Tool Calls"
      headerRight={
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="text-success">{successCount}ok</span>
          <span className="text-error">{failCount}err</span>
          {pendingCount > 0 && <span className="text-warning">{pendingCount}run</span>}
        </div>
      }
    >
      {/* Filter */}
      <div className="p-2 border-b border-border">
        <input
          type="text"
          placeholder="Filter tools..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full bg-bg-input text-text-secondary text-xs rounded px-2 py-1.5 border border-border outline-none focus:border-accent placeholder:text-text-muted"
        />
      </div>

      {/* Feed */}
      <div className="overflow-auto">
        {filtered.length === 0 && (
          <div className="p-4 text-center text-text-muted text-sm">
            {toolCalls.length === 0 ? "No tool calls yet" : "No matches"}
          </div>
        )}
        {filtered.map((tc) => {
          const isExpanded = expandedId === tc.call_id;
          const isPending = tc.success === undefined;
          const statusColor = isPending
            ? "var(--warning)"
            : tc.success
            ? "var(--success)"
            : "var(--error)";

          return (
            <div
              key={tc.call_id}
              className="border-b border-border last:border-0 animate-fade-in"
            >
              <button
                className="w-full text-left px-3 py-2 hover:bg-bg-input transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : tc.call_id)}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${isPending ? "animate-pulse-dot" : ""}`}
                    style={{ backgroundColor: statusColor }}
                  />
                  <span className="text-sm font-mono text-text-primary truncate flex-1">
                    {tc.tool_name}
                  </span>
                  {tc.latency_ms !== undefined && (
                    <span className="text-[10px] font-mono text-text-muted shrink-0">
                      {tc.latency_ms < 1000
                        ? `${Math.round(tc.latency_ms)}ms`
                        : `${(tc.latency_ms / 1000).toFixed(1)}s`}
                    </span>
                  )}
                </div>
                {/* Compact input preview */}
                <div className="text-xs text-text-muted truncate mt-0.5 pl-3.5">
                  {summarizeInputs(tc.inputs)}
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-2 animate-fade-in">
                  <DetailBlock label="Inputs" content={JSON.stringify(tc.inputs, null, 2)} />
                  {tc.result && <DetailBlock label="Result" content={tc.result} />}
                  {tc.error && <DetailBlock label="Error" content={tc.error} isError />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function summarizeInputs(inputs: Record<string, unknown>): string {
  const entries = Object.entries(inputs);
  if (entries.length === 0) return "(no inputs)";
  return entries
    .map(([k, v]) => {
      const s = typeof v === "string" ? v : JSON.stringify(v);
      return `${k}: ${s.length > 40 ? s.slice(0, 40) + "..." : s}`;
    })
    .join(", ");
}

function DetailBlock({ label, content, isError }: { label: string; content: string; isError?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase text-text-muted tracking-wider mb-1">{label}</div>
      <pre
        className={`text-xs font-mono p-2 rounded overflow-auto max-h-40 ${
          isError ? "bg-error/10 text-error" : "bg-bg-input text-text-secondary"
        }`}
      >
        {content}
      </pre>
    </div>
  );
}
