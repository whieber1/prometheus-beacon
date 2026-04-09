import { z } from 'zod';
import { randomUUID } from 'crypto';
import { router, protectedProcedure } from '../trpc';
import { getGatewayBridge } from '../gateway/bridge';
import { ChatHistoryResponseSchema, SessionsListResponseSchema } from '../gateway/types';

const PROMETHEUS_API = process.env.PROMETHEUS_API_URL ?? 'http://localhost:8005';

/**
 * Parse Python repr content blocks from the Prometheus REST API into
 * structured ChatMessage content. The API returns strings like:
 *   [TextBlock(type='text', text='Hello')]
 *   [ToolUseBlock(type='tool_use', id='...', name='web_search', input={...})]
 *   [ToolResultBlock(type='tool_result', tool_use_id='...', content='...', is_error=False)]
 */
function parsePrometheusContent(raw: string): string | Array<{ type: string; [key: string]: unknown }> {
  // If it doesn't look like a Python repr block array, return as plain text
  if (!raw.startsWith('[') || (!raw.includes('TextBlock') && !raw.includes('ToolUseBlock') && !raw.includes('ToolResultBlock'))) {
    return raw;
  }

  const parts: Array<{ type: string; [key: string]: unknown }> = [];

  // Match TextBlock(type='text', text='...')
  const textMatches = raw.matchAll(/TextBlock\(type='text',\s*text='((?:[^'\\]|\\.)*)'\)/g);
  for (const m of textMatches) {
    parts.push({ type: 'text', text: m[1].replace(/\\'/g, "'").replace(/\\n/g, '\n') });
  }

  // Match ToolUseBlock(type='tool_use', id='...', name='...', input={...})
  const toolUseMatches = raw.matchAll(/ToolUseBlock\(type='tool_use',\s*id='([^']*)',\s*name='([^']*)',\s*input=(\{[^)]*\})\)/g);
  for (const m of toolUseMatches) {
    let args: unknown = {};
    try { args = JSON.parse(m[3].replace(/'/g, '"')); } catch { args = m[3]; }
    parts.push({ type: 'toolCall', name: m[2], arguments: args, toolCallId: m[1] });
  }

  // Match ToolResultBlock(type='tool_result', tool_use_id='...', content='...', is_error=...)
  const toolResultMatches = raw.matchAll(/ToolResultBlock\(type='tool_result',\s*tool_use_id='([^']*)',\s*content="((?:[^"\\]|\\.)*)"/g);
  for (const m of toolResultMatches) {
    parts.push({ type: 'toolResult', content: m[2].replace(/\\"/g, '"').replace(/\\n/g, '\n'), toolUseId: m[1], isError: false });
  }
  // Also match single-quoted content
  const toolResultMatches2 = raw.matchAll(/ToolResultBlock\(type='tool_result',\s*tool_use_id='([^']*)',\s*content='((?:[^'\\]|\\.)*)'/g);
  for (const m of toolResultMatches2) {
    // Skip if already matched by double-quote version
    if (!parts.some(p => p.type === 'toolResult' && p.toolUseId === m[1])) {
      parts.push({ type: 'toolResult', content: m[2].replace(/\\'/g, "'").replace(/\\n/g, '\n'), toolUseId: m[1], isError: raw.includes('is_error=True') });
    }
  }

  return parts.length > 0 ? parts : raw;
}

export const sessionsRouter = router({
  list: protectedProcedure.query(async () => {
    // Try the Python REST API first (works with Prometheus backend)
    try {
      const res = await fetch(`${PROMETHEUS_API}/api/sessions`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const raw = (await res.json()) as Array<{
          session_id: string;
          created_at: number;
          message_count: number;
        }>;
        const sessions = raw.map((s) => ({
          key: s.session_id,
          kind: 'prometheus' as const,
          label: s.session_id,
          updatedAt: s.created_at * 1000, // convert seconds to ms
          totalTokens: 0,
        }));
        return { ts: Date.now() / 1000, count: sessions.length, sessions };
      }
    } catch {
      // REST failed, fall through to bridge
    }

    // Fallback: try OpenClaw bridge protocol
    try {
      const bridge = getGatewayBridge();
      const result = await bridge.request<unknown>('sessions.list', {});
      return SessionsListResponseSchema.parse(result);
    } catch {
      return { ts: Date.now() / 1000, count: 0, sessions: [] };
    }
  }),

  history: protectedProcedure
    .input(z.object({ sessionKey: z.string(), limit: z.number().int().min(1).max(500).default(100) }))
    .query(async ({ input }) => {
      // Try Prometheus REST API first
      try {
        const res = await fetch(
          `${PROMETHEUS_API}/api/sessions/${encodeURIComponent(input.sessionKey)}/messages`,
          { signal: AbortSignal.timeout(8000) },
        );
        if (res.ok) {
          const raw = (await res.json()) as Array<{
            message_id: string;
            session_id: string;
            role: string;
            content: string;
            timestamp: number;
          }>;
          const messages = raw.slice(-input.limit).map((m) => ({
            role: m.role as 'user' | 'assistant' | 'system' | 'tool' | 'toolResult',
            content: parsePrometheusContent(m.content),
            id: m.message_id,
            createdAt: m.timestamp > 0 ? m.timestamp * 1000 : undefined,
          }));
          return { sessionKey: input.sessionKey, messages };
        }
      } catch {
        // REST failed, fall through to bridge
      }

      // Fallback: try OpenClaw bridge protocol
      try {
        const bridge = getGatewayBridge();
        const result = await bridge.request<unknown>('chat.history', {
          sessionKey: input.sessionKey,
          limit: input.limit,
        });
        return ChatHistoryResponseSchema.parse(result);
      } catch {
        return { sessionKey: input.sessionKey, messages: [] };
      }
    }),

  send: protectedProcedure
    .input(z.object({
      sessionKey: z.string(),
      message: z.string().min(1),
      idempotencyKey: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const idempotencyKey = input.idempotencyKey ?? randomUUID();

      // Try Prometheus REST API first
      // TODO(python-side): Expose POST /api/chat/send { session_id, message }
      try {
        const res = await fetch(`${PROMETHEUS_API}/api/chat/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: input.sessionKey,
            message: input.message,
            idempotency_key: idempotencyKey,
          }),
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const data = (await res.json()) as { run_id?: string; status?: string };
          return { runId: data.run_id ?? idempotencyKey, status: data.status ?? 'sent' };
        }
      } catch {
        // REST not available, try bridge
      }

      // Fallback: try OpenClaw bridge protocol
      try {
        const bridge = getGatewayBridge();
        const result = await bridge.request<{ runId: string; status: string }>('chat.send', {
          sessionKey: input.sessionKey,
          message: input.message,
          idempotencyKey,
        });
        return result;
      } catch {
        throw new Error('Could not send message — Prometheus bridge unavailable');
      }
    }),
});
