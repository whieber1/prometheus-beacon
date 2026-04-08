// Agent states matching Prometheus SENTINEL/engine states
export type AgentState = "idle" | "thinking" | "running" | "dreaming" | "errored";

export interface AgentStatus {
  state: AgentState;
  model: string;
  provider: string;
  profile: string;
  uptime_seconds: number;
}

export interface Session {
  session_id: string;
  created_at: number;
  message_count: number;
}

export interface ChatMessage {
  message_id: string;
  session_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: number;
}

export interface ToolCall {
  call_id: string;
  tool_name: string;
  inputs: Record<string, unknown>;
  result?: string;
  error?: string;
  success?: boolean;
  latency_ms?: number;
  started_at: number;
  finished_at?: number;
}

export interface LCMState {
  session_id: string;
  total_tokens: number;
  limit: number;
  compression_ratio: number;
  fresh_count: number;
  summary_count: number;
}

export interface SentinelState {
  state: "active" | "dreaming" | "idle";
  last_dream: number | null;
  dream_count: number;
  idle_since: number | null;
  dream_log_tail: DreamEntry[];
}

export interface DreamEntry {
  cycle: number;
  timestamp: number;
  phases: DreamPhase[];
}

export interface DreamPhase {
  phase: string;
  status: "ok" | "error" | "skipped";
  duration_seconds: number;
  summary: Record<string, unknown>;
}

export interface SkillInfo {
  name: string;
  description: string;
  source: "builtin" | "user" | "auto";
}

export interface ProfileInfo {
  name: string;
  description: string;
  is_active: boolean;
}

export interface TelemetryReport {
  total_calls: number;
  overall_success_rate: number;
  tools: Record<string, ToolTelemetry>;
}

export interface ToolTelemetry {
  calls: number;
  successes: number;
  failures: number;
  success_rate: number;
  avg_retries: number;
  avg_latency_ms: number;
}

export interface WikiStats {
  page_count: number;
  entity_counts: Record<string, number>;
  last_compiled: number | null;
}

export interface PrometheusConfig {
  raw_yaml: string;
  parsed: Record<string, unknown>;
}

// Unified app state
export interface MissionControlState {
  connected: boolean;
  reconnecting: boolean;
  status: AgentStatus | null;
  sessions: Session[];
  activeSessionId: string | null;
  messages: ChatMessage[];
  streamingContent: string;
  streamingMessageId: string | null;
  toolCalls: ToolCall[];
  lcm: LCMState | null;
  sentinel: SentinelState | null;
  skills: SkillInfo[];
  profiles: ProfileInfo[];
  telemetry: TelemetryReport | null;
  wiki: WikiStats | null;
  config: PrometheusConfig | null;
}
