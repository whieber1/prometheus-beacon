// WebSocket event types matching the spec

export interface WSEvent {
  type: string;
  timestamp: number;
  payload: Record<string, unknown>;
  source?: string;
}

// Server → Client events
export interface ConnectedEvent extends WSEvent {
  type: "connected";
  payload: { version: string };
}

export interface AgentStateEvent extends WSEvent {
  type: "agent_state";
  payload: {
    state: "idle" | "thinking" | "running" | "dreaming" | "errored";
    model?: string;
    provider?: string;
  };
}

export interface ChatMessageEvent extends WSEvent {
  type: "chat_message";
  payload: {
    session_id: string;
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    message_id: string;
  };
}

export interface ChatDeltaEvent extends WSEvent {
  type: "chat_delta";
  payload: {
    session_id: string;
    content: string;
    message_id: string;
  };
}

export interface ChatDoneEvent extends WSEvent {
  type: "chat_done";
  payload: { session_id: string; message_id: string };
}

export interface ToolCallStartEvent extends WSEvent {
  type: "tool_call_start";
  payload: {
    call_id: string;
    tool_name: string;
    inputs: Record<string, unknown>;
  };
}

export interface ToolCallEndEvent extends WSEvent {
  type: "tool_call_end";
  payload: {
    call_id: string;
    tool_name: string;
    success: boolean;
    result?: string;
    error?: string;
    latency_ms: number;
  };
}

export interface LCMUpdateEvent extends WSEvent {
  type: "lcm_update";
  payload: {
    session_id: string;
    total_tokens: number;
    limit: number;
    compression_ratio: number;
    fresh_count: number;
    summary_count: number;
  };
}

export interface SentinelSignalEvent extends WSEvent {
  type: "sentinel_signal";
  payload: {
    kind: string;
    payload: Record<string, unknown>;
    source: string;
  };
}

export interface DreamStartEvent extends WSEvent {
  type: "dream_start";
  payload: { cycle: number };
}

export interface DreamPhaseEvent extends WSEvent {
  type: "dream_phase";
  payload: {
    cycle: number;
    phase: string;
    status: "ok" | "error" | "skipped";
    summary: Record<string, unknown>;
  };
}

export interface DreamCompleteEvent extends WSEvent {
  type: "dream_complete";
  payload: {
    cycle: number;
    results: Record<string, unknown>;
  };
}

export interface SessionListEvent extends WSEvent {
  type: "session_list";
  payload: {
    sessions: Array<{
      session_id: string;
      created_at: number;
      message_count: number;
    }>;
  };
}

export interface ErrorEvent extends WSEvent {
  type: "error";
  payload: { message: string; code?: string };
}

// Client → Server commands
export interface SendMessageCommand {
  type: "send_message";
  payload: { session_id: string; content: string };
}

export interface SwitchSessionCommand {
  type: "switch_session";
  payload: { session_id: string };
}

export interface SubscribeCommand {
  type: "subscribe";
  payload: { channels: string[] };
}

export type ClientCommand = SendMessageCommand | SwitchSessionCommand | SubscribeCommand;
