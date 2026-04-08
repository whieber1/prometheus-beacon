"use client";

import { useState, useRef, useEffect } from "react";
import { Panel } from "@/components/ui/Panel";
import type { ChatMessage, Session } from "@/lib/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  streamingContent: string;
  sessions: Session[];
  activeSessionId: string | null;
  onSend: (content: string) => void;
  onSwitchSession: (id: string) => void;
  onNewSession: () => void;
}

const ROLE_STYLES: Record<string, { label: string; color: string }> = {
  user: { label: "YOU", color: "var(--info)" },
  assistant: { label: "AI", color: "var(--accent)" },
  system: { label: "SYS", color: "var(--warning)" },
  tool: { label: "TOOL", color: "var(--success)" },
};

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatPanel({
  messages,
  streamingContent,
  sessions,
  activeSessionId,
  onSend,
  onSwitchSession,
  onNewSession,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    // Auto-resize
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }

  const sessionHeader = (
    <div className="flex items-center gap-2">
      <select
        className="bg-bg-input text-text-secondary text-xs rounded px-2 py-1 border border-border outline-none"
        value={activeSessionId || ""}
        onChange={(e) => onSwitchSession(e.target.value)}
      >
        {sessions.length === 0 && <option value="">No sessions</option>}
        {sessions.map((s) => (
          <option key={s.session_id} value={s.session_id}>
            {s.session_id.slice(0, 8)}... ({s.message_count} msgs)
          </option>
        ))}
      </select>
      <button
        onClick={onNewSession}
        className="text-xs text-accent hover:text-accent-dim px-2 py-1 rounded border border-border hover:border-accent transition-colors"
      >
        + New
      </button>
    </div>
  );

  return (
    <Panel title="Chat" className="h-full" headerRight={sessionHeader}>
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 && !streamingContent && (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            {activeSessionId ? "No messages yet" : "Select or create a session"}
          </div>
        )}

        {messages.map((msg) => {
          const style = ROLE_STYLES[msg.role] || ROLE_STYLES.system;
          return (
            <div key={msg.message_id} className="animate-fade-in">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: style.color + "20", color: style.color }}
                >
                  {style.label}
                </span>
                <span className="text-[10px] text-text-muted">{formatTime(msg.timestamp)}</span>
              </div>
              <div className="text-sm text-text-primary whitespace-pre-wrap break-words pl-1 leading-relaxed">
                {msg.content}
              </div>
            </div>
          );
        })}

        {/* Streaming response */}
        {streamingContent && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                style={{ backgroundColor: "var(--accent)20", color: "var(--accent)" }}
              >
                AI
              </span>
              <span className="text-[10px] text-text-muted animate-pulse-dot">streaming...</span>
            </div>
            <div className="text-sm text-text-primary whitespace-pre-wrap break-words pl-1 leading-relaxed">
              {streamingContent}
              <span className="inline-block w-1.5 h-4 bg-accent ml-0.5 animate-pulse-dot" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 bg-bg-secondary shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={activeSessionId ? "Send a message..." : "Create a session first"}
            disabled={!activeSessionId}
            rows={1}
            className="flex-1 bg-bg-input text-text-primary text-sm rounded-lg px-3 py-2 border border-border focus:border-accent outline-none resize-none placeholder:text-text-muted disabled:opacity-50 min-h-[40px]"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !activeSessionId}
            className="px-4 py-2 bg-accent text-white text-sm font-semibold rounded-lg hover:bg-accent-dim transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0 min-h-[40px]"
          >
            Send
          </button>
        </div>
      </div>
    </Panel>
  );
}
