import { z } from 'zod';

// ─── Wire protocol frames ─────────────────────────────────────────────────────

export const RequestFrameSchema = z.object({
  type: z.literal('req'),
  id: z.string(),
  method: z.string(),
  params: z.unknown().optional(),
});
export type RequestFrame = z.infer<typeof RequestFrameSchema>;

export const ResponseFrameSchema = z.object({
  type: z.literal('res'),
  id: z.string(),
  ok: z.boolean(),
  payload: z.unknown().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    retryable: z.boolean().optional(),
    retryAfterMs: z.number().optional(),
  }).optional(),
});
export type ResponseFrame = z.infer<typeof ResponseFrameSchema>;

export const EventFrameSchema = z.object({
  type: z.literal('event'),
  event: z.string(),
  seq: z.number().optional(),
  stateVersion: z.unknown().optional(),
  payload: z.unknown().optional(),
});
export type EventFrame = z.infer<typeof EventFrameSchema>;

export const GatewayFrameSchema = z.discriminatedUnion('type', [
  RequestFrameSchema,
  ResponseFrameSchema,
  EventFrameSchema,
]);
export type GatewayFrame = z.infer<typeof GatewayFrameSchema>;

// ─── Connect / auth ───────────────────────────────────────────────────────────

export const ConnectChallengePayloadSchema = z.object({
  nonce: z.string(),
  ts: z.number(),
});

export const ConnectParamsSchema = z.object({
  auth: z.object({ token: z.string().optional(), password: z.string().optional() }).optional(),
  role: z.string(),
  scopes: z.array(z.string()),
  minProtocol: z.number(),
  maxProtocol: z.number(),
  client: z.object({
    id: z.string(),
    version: z.string(),
    platform: z.string(),
    mode: z.string(),
    displayName: z.string().optional(),
    instanceId: z.string().optional(),
  }),
  caps: z.array(z.string()),
});

export const HelloOkSchema = z.object({
  type: z.literal('hello-ok'),
  protocol: z.number(),
  server: z.object({
    version: z.string(),
    host: z.string(),
    connId: z.string(),
  }),
  features: z.object({
    methods: z.array(z.string()),
  }).optional(),
  policy: z.object({
    tickIntervalMs: z.number().optional(),
  }).optional(),
  auth: z.object({
    deviceToken: z.string().optional(),
    role: z.string().optional(),
    scopes: z.array(z.string()).optional(),
  }).optional(),
});
export type HelloOk = z.infer<typeof HelloOkSchema>;

// ─── Sessions ────────────────────────────────────────────────────────────────

export const SessionSchema = z.object({
  key: z.string(),
  kind: z.string(),
  label: z.string().optional(),
  displayName: z.string().optional(),
  channel: z.string().optional(),
  updatedAt: z.number().optional(),
  sessionId: z.string().optional(),
  abortedLastRun: z.boolean().optional(),
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  totalTokens: z.number().optional(),
  modelProvider: z.string().optional(),
  model: z.string().optional(),
  contextTokens: z.number().optional(),
  deliveryContext: z.record(z.string(), z.unknown()).optional(),
  lastChannel: z.string().optional(),
  lastTo: z.string().optional(),
  lastAccountId: z.string().optional(),
  systemSent: z.boolean().optional(),
});
export type Session = z.infer<typeof SessionSchema>;

export const SessionsListResponseSchema = z.object({
  ts: z.number(),
  path: z.string().optional(),
  count: z.number(),
  defaults: z.record(z.string(), z.unknown()).optional(),
  sessions: z.array(SessionSchema),
});
export type SessionsListResponse = z.infer<typeof SessionsListResponseSchema>;

// ─── Agents ───────────────────────────────────────────────────────────────────

export const AgentSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  model: z.string().optional(),
  description: z.string().optional(),
});
export type Agent = z.infer<typeof AgentSchema>;

export const AgentsListResponseSchema = z.object({
  defaultId: z.string().optional(),
  mainKey: z.string().optional(),
  scope: z.string().optional(),
  agents: z.array(AgentSchema),
});
export type AgentsListResponse = z.infer<typeof AgentsListResponseSchema>;

// ─── Chat messages ────────────────────────────────────────────────────────────

export const ContentPartSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({
    type: z.literal('toolCall'),
    id: z.string(),
    name: z.string(),
    arguments: z.unknown(),
  }),
  z.object({
    type: z.literal('toolResult'),
    toolCallId: z.string(),
    content: z.unknown(),
    isError: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('thinking'),
    thinking: z.string(),
  }),
]);
export type ContentPart = z.infer<typeof ContentPartSchema>;

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool', 'toolResult']),
  content: z.union([z.string(), z.array(z.unknown())]),
  id: z.string().optional(),
  createdAt: z.number().optional(),
  runId: z.string().optional(),
  toolCallId: z.string().optional(),
  toolName: z.string().optional(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatHistoryResponseSchema = z.object({
  sessionKey: z.string(),
  sessionId: z.string().optional(),
  messages: z.array(ChatMessageSchema),
});
export type ChatHistoryResponse = z.infer<typeof ChatHistoryResponseSchema>;

// ─── Chat send ───────────────────────────────────────────────────────────────

export const ChatSendResponseSchema = z.object({
  runId: z.string(),
  status: z.string(),
});
export type ChatSendResponse = z.infer<typeof ChatSendResponseSchema>;

// ─── Exec approvals ──────────────────────────────────────────────────────────

export const ExecApprovalRequestSchema = z.object({
  id: z.string(),
  sessionKey: z.string().optional(),
  agentId: z.string().optional(),
  command: z.string(),
  host: z.string().optional(),
  cwd: z.string().optional(),
  expiresAt: z.number().optional(),
  requestedAt: z.number().optional(),
  requestedBy: z.string().optional(),
});
export type ExecApprovalRequest = z.infer<typeof ExecApprovalRequestSchema>;

export const ApprovalDecisionSchema = z.enum(['allow_once', 'always_allow', 'deny']);
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;

// ─── Gateway connection state ─────────────────────────────────────────────────

export type GatewayConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

// ─── Browser WebSocket protocol (server → client) ────────────────────────────

export const BrowserMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('welcome'), message: z.string() }),
  z.object({ type: z.literal('gateway_connected') }),
  z.object({ type: z.literal('gateway_disconnected') }),
  z.object({ type: z.literal('gateway_reconnecting'), attempt: z.number() }),
  z.object({ type: z.literal('sessions_snapshot'), sessions: z.array(SessionSchema) }),
  z.object({ type: z.literal('session_event'), sessionKey: z.string(), event: EventFrameSchema }),
  z.object({ type: z.literal('approval_request'), approval: ExecApprovalRequestSchema }),
  z.object({ type: z.literal('approval_resolved'), approvalId: z.string() }),
  z.object({ type: z.literal('agent_status_changed'), agentId: z.string(), status: z.string() }),
  z.object({ type: z.literal('activity'), eventName: z.string(), payload: z.unknown() }),
  z.object({ type: z.literal('gateway_event'), event: EventFrameSchema }),
]);
export type BrowserMessage = z.infer<typeof BrowserMessageSchema>;

// ─── Browser → Server messages ────────────────────────────────────────────────

export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('send_message'), sessionKey: z.string(), message: z.string(), idempotencyKey: z.string() }),
  z.object({ type: z.literal('resolve_approval'), id: z.string(), decision: ApprovalDecisionSchema }),
  z.object({ type: z.literal('subscribe_session'), sessionKey: z.string() }),
  z.object({ type: z.literal('unsubscribe_session'), sessionKey: z.string() }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ─── Prometheus event types (WS :8010) ──────────────────────────────────────

export type PrometheusAgentState = 'idle' | 'thinking' | 'running' | 'dreaming' | 'errored';

export interface PrometheusEvent {
  type: string;
  timestamp: number;
  payload: Record<string, unknown>;
  source?: string;
}

export interface PrometheusToolCall {
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

export interface PrometheusLCMState {
  session_id: string;
  total_tokens: number;
  limit: number;
  compression_ratio: number;
  fresh_count: number;
  summary_count: number;
}

export interface PrometheusSentinelState {
  state: 'active' | 'dreaming' | 'idle';
  last_dream: number | null;
  dream_count: number;
  idle_since: number | null;
}

export interface PrometheusStatus {
  state: PrometheusAgentState;
  model: string;
  provider: string;
  profile: string;
  uptime_seconds: number;
}

export interface PrometheusSkill {
  name: string;
  description: string;
  source: 'builtin' | 'user' | 'auto';
}

export interface PrometheusProfile {
  name: string;
  description: string;
  is_active: boolean;
}

export interface PrometheusTelemetryTool {
  calls: number;
  successes: number;
  failures: number;
  success_rate: number;
  avg_retries: number;
  avg_latency_ms: number;
}

export interface PrometheusTelemetry {
  total_calls: number;
  overall_success_rate: number;
  tools: Record<string, PrometheusTelemetryTool>;
}

export interface PrometheusWikiStats {
  page_count: number;
  entity_counts: Record<string, number>;
  last_compiled: number | null;
}
