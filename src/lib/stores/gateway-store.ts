'use client';

import { create } from 'zustand';
import type {
  GatewayConnectionState,
  Session,
  Agent,
  ExecApprovalRequest,
  EventFrame,
  PrometheusToolCall,
  PrometheusLCMState,
  PrometheusSentinelState,
  PrometheusStatus,
  PrometheusSkill,
  PrometheusProfile,
  PrometheusTelemetry,
  PrometheusWikiStats,
  PrometheusEvent,
  PrometheusAgentState,
} from '@/server/gateway/types';

/**
 * Extract clean text from Python repr content blocks.
 * Converts "[TextBlock(type='text', text='Hello')]" → "Hello"
 * Passes through plain strings unchanged.
 */
function extractTextFromRepr(raw: string): string {
  if (!raw.startsWith('[') || !raw.includes('TextBlock')) return raw;
  // Match text='...' or text="..." inside TextBlock(...)
  const parts: string[] = [];
  const singleQuote = raw.matchAll(/TextBlock\(type='text',\s*text='((?:[^'\\]|\\.)*)'\)/g);
  for (const m of singleQuote) parts.push(m[1].replace(/\\'/g, "'").replace(/\\n/g, '\n'));
  const doubleQuote = raw.matchAll(/TextBlock\(type='text',\s*text="((?:[^"\\]|\\.)*)"\)/g);
  for (const m of doubleQuote) parts.push(m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'));
  return parts.length > 0 ? parts.join('\n') : raw;
}

export type ActivityCategory =
  | 'message'
  | 'tool'
  | 'session'
  | 'approval'
  | 'agent'
  | 'system'
  | 'other';

export interface ActivityEvent {
  id: string;
  eventName: string;
  payload: unknown;
  receivedAt: number;
  sessionKey?: string;
  category: ActivityCategory;
  summary?: string;
}

export function categorizeEvent(eventName: string, payload: unknown): ActivityCategory {
  // Prometheus events
  if (eventName.startsWith('chat_') || eventName === 'chat_message' || eventName === 'chat_delta' || eventName === 'chat_done') return 'message';
  if (eventName.startsWith('tool_call')) return 'tool';
  if (eventName === 'agent_state') return 'agent';
  if (eventName.startsWith('lcm_') || eventName.startsWith('sentinel_') || eventName.startsWith('dream_')) return 'system';
  if (eventName === 'session_list' || eventName === 'connected') return 'session';
  // Legacy events
  if (eventName.startsWith('chat.') || eventName.startsWith('message')) return 'message';
  if (eventName.startsWith('tool.') || eventName === 'exec.approval.request' || eventName === 'exec.approval.resolved') return 'tool';
  if (eventName.startsWith('exec.')) return 'tool';
  if (eventName.startsWith('sessions.') || eventName === 'session_event') return 'session';
  if (eventName.startsWith('agent.')) return 'agent';
  if (eventName.startsWith('gateway_') || eventName.startsWith('connect.')) return 'system';
  if (eventName.includes('approval')) return 'approval';
  return 'other';
}

export function summarizeEvent(eventName: string, payload: unknown): string | undefined {
  try {
    const p = payload as Record<string, unknown> | null;
    if (!p) return undefined;
    if (eventName === 'exec.approval.request') return `exec: ${String(p.command ?? '').slice(0, 80)}`;
    if (eventName === 'sessions.updated' && p.sessions) return `${(p.sessions as unknown[]).length} sessions`;
    if (p.message && typeof p.message === 'string') return p.message.slice(0, 80);
    if (p.text && typeof p.text === 'string') return p.text.slice(0, 80);
    if (p.content && typeof p.content === 'string') return p.content.slice(0, 80);
    if (p.name && typeof p.name === 'string') return p.name;
    if (p.sessionKey && typeof p.sessionKey === 'string') return `session: ${p.sessionKey}`;
  } catch { /* noop */ }
  return undefined;
}

interface GatewayStore {
  // Connection
  connectionState: GatewayConnectionState;
  ws: WebSocket | null;

  // Data
  sessions: Record<string, Session>;
  agents: Agent[];
  pendingApprovals: ExecApprovalRequest[];
  activityFeed: ActivityEvent[];

  // Prometheus data
  prometheusStatus: PrometheusStatus | null;
  toolCalls: PrometheusToolCall[];
  lcmState: PrometheusLCMState | null;
  sentinelState: PrometheusSentinelState | null;
  skills: PrometheusSkill[];
  profiles: PrometheusProfile[];
  telemetry: PrometheusTelemetry | null;
  wikiStats: PrometheusWikiStats | null;
  chatMessages: Array<{ id: string; session_id: string; role: string; content: string; timestamp: number }>;
  streamingContent: string;
  streamingMessageId: string | null;

  // Actions
  setConnectionState: (state: GatewayConnectionState) => void;
  setWs: (ws: WebSocket | null) => void;
  setSessions: (sessions: Session[]) => void;
  updateSession: (session: Session) => void;
  setAgents: (agents: Agent[]) => void;
  addApproval: (approval: ExecApprovalRequest) => void;
  resolveApproval: (approvalId: string) => void;
  addActivity: (event: ActivityEvent) => void;
  handleGatewayEvent: (event: EventFrame) => void;
  handlePrometheusEvent: (event: PrometheusEvent) => void;
  setPrometheusStatus: (status: PrometheusStatus) => void;
  setSkills: (skills: PrometheusSkill[]) => void;
  setProfiles: (profiles: PrometheusProfile[]) => void;
  setTelemetry: (telemetry: PrometheusTelemetry) => void;
  setWikiStats: (stats: PrometheusWikiStats) => void;
}

export const useGatewayStore = create<GatewayStore>((set, get) => ({
  connectionState: 'idle',
  ws: null,
  sessions: {},
  agents: [],
  pendingApprovals: [],
  activityFeed: [],

  // Prometheus state
  prometheusStatus: null,
  toolCalls: [],
  lcmState: null,
  sentinelState: null,
  skills: [],
  profiles: [],
  telemetry: null,
  wikiStats: null,
  chatMessages: [],
  streamingContent: '',
  streamingMessageId: null,

  setConnectionState: (state) => set({ connectionState: state }),
  setWs: (ws) => set({ ws }),

  setSessions: (sessions) => {
    const map: Record<string, Session> = {};
    for (const s of sessions) map[s.key] = s;
    set({ sessions: map });
  },

  updateSession: (session) =>
    set((state) => ({
      sessions: { ...state.sessions, [session.key]: session },
    })),

  setAgents: (agents) => set({ agents }),

  addApproval: (approval) =>
    set((state) => ({
      pendingApprovals: [...state.pendingApprovals.filter((a) => a.id !== approval.id), approval],
    })),

  resolveApproval: (approvalId) =>
    set((state) => ({
      pendingApprovals: state.pendingApprovals.filter((a) => a.id !== approvalId),
    })),

  addActivity: (event) =>
    set((state) => ({
      activityFeed: [event, ...state.activityFeed].slice(0, 500),
    })),

  handleGatewayEvent: (event) => {
    const store = get();
    const p = event.payload as Record<string, unknown> | null | undefined;

    // Track all events in activity feed with enriched metadata
    store.addActivity({
      id: `${event.event}-${Date.now()}-${Math.random()}`,
      eventName: event.event,
      payload: event.payload,
      receivedAt: Date.now(),
      sessionKey: (p?.sessionKey as string | undefined) ?? (p?.key as string | undefined),
      category: categorizeEvent(event.event, event.payload),
      summary: summarizeEvent(event.event, event.payload),
    });

    // Handle sessions update
    if (event.event === 'sessions.updated' || event.event === 'sessions.list') {
      const payload = event.payload as { sessions?: Session[] } | undefined;
      if (Array.isArray(payload?.sessions)) {
        store.setSessions(payload.sessions);
      }
    }

    // Handle approval requests
    if (event.event === 'exec.approval.request') {
      const approval = event.payload as ExecApprovalRequest | undefined;
      if (approval?.id) store.addApproval(approval);
    }

    // Handle approval resolved
    if (event.event === 'exec.approval.resolved') {
      const payload = event.payload as { id?: string } | undefined;
      if (payload?.id) store.resolveApproval(payload.id);
    }
  },

  // ── Prometheus actions ────────────────────────────────────────────────
  setPrometheusStatus: (status) => set({ prometheusStatus: status }),
  setSkills: (skills) => set({ skills }),
  setProfiles: (profiles) => set({ profiles }),
  setTelemetry: (telemetry) => set({ telemetry }),
  setWikiStats: (stats) => set({ wikiStats: stats }),

  handlePrometheusEvent: (event: PrometheusEvent) => {
    const store = get();
    const p = event.payload;

    // Always add to activity feed
    store.addActivity({
      id: `prom-${event.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      eventName: event.type,
      payload: p,
      receivedAt: Date.now(),
      sessionKey: p.session_id as string | undefined,
      category: categorizeEvent(event.type, p),
      summary: summarizeEvent(event.type, p),
    });

    switch (event.type) {
      case 'agent_state': {
        const cur = store.prometheusStatus;
        set({
          prometheusStatus: {
            state: (p.state as PrometheusAgentState) || 'idle',
            model: (p.model as string) || cur?.model || 'unknown',
            provider: (p.provider as string) || cur?.provider || 'unknown',
            profile: (p.profile as string) || cur?.profile || 'full',
            uptime_seconds: (p.uptime_seconds as number) || cur?.uptime_seconds || 0,
          },
        });
        break;
      }

      case 'chat_message': {
        const rawContent = (p.content as string) || '';
        const msg = {
          id: (p.message_id as string) || `msg-${Date.now()}`,
          session_id: (p.session_id as string) || '',
          role: (p.role as string) || 'assistant',
          content: extractTextFromRepr(rawContent),
          timestamp: event.timestamp,
        };
        set((s) => ({
          chatMessages: [...s.chatMessages, msg].slice(-500),
        }));
        break;
      }

      case 'chat_delta':
        set((s) => ({
          streamingContent:
            s.streamingMessageId === (p.message_id as string)
              ? s.streamingContent + (p.content as string)
              : (p.content as string),
          streamingMessageId: (p.message_id as string) || null,
        }));
        break;

      case 'chat_done':
        set((s) => {
          if (s.streamingMessageId === (p.message_id as string) && s.streamingContent) {
            return {
              chatMessages: [
                ...s.chatMessages,
                {
                  id: p.message_id as string,
                  session_id: (p.session_id as string) || '',
                  role: 'assistant',
                  content: s.streamingContent,
                  timestamp: Date.now() / 1000,
                },
              ].slice(-500),
              streamingContent: '',
              streamingMessageId: null,
            };
          }
          return { streamingContent: '', streamingMessageId: null };
        });
        break;

      case 'tool_call_start':
        set((s) => ({
          toolCalls: [
            {
              call_id: (p.call_id as string) || `tc-${Date.now()}`,
              tool_name: (p.tool_name as string) || '',
              inputs: (p.inputs as Record<string, unknown>) || {},
              started_at: event.timestamp,
            },
            ...s.toolCalls,
          ].slice(0, 200),
        }));
        break;

      case 'tool_call_end':
        set((s) => ({
          toolCalls: s.toolCalls.map((tc) =>
            tc.call_id === (p.call_id as string)
              ? {
                  ...tc,
                  success: p.success as boolean,
                  result: p.result as string | undefined,
                  error: p.error as string | undefined,
                  latency_ms: p.latency_ms as number,
                  finished_at: event.timestamp,
                }
              : tc
          ),
        }));
        break;

      case 'lcm_update':
        set({
          lcmState: {
            session_id: (p.session_id as string) || '',
            total_tokens: (p.total_tokens as number) || 0,
            limit: (p.limit as number) || 24000,
            compression_ratio: (p.compression_ratio as number) || 0,
            fresh_count: (p.fresh_count as number) || 0,
            summary_count: (p.summary_count as number) || 0,
          },
        });
        break;

      case 'sentinel_signal':
      case 'dream_start':
      case 'dream_complete':
        // Could fetch sentinel state from REST here
        break;

      case 'session_list':
        if (Array.isArray(p.sessions)) {
          const sesMap: Record<string, Session> = {};
          for (const s of p.sessions as Array<Record<string, unknown>>) {
            const key = (s.session_id as string) || '';
            sesMap[key] = {
              key,
              kind: 'prometheus',
              label: key.slice(0, 8),
              updatedAt: (s.created_at as number) || 0,
            };
          }
          set({ sessions: sesMap });
        }
        break;
    }
  },
}));
