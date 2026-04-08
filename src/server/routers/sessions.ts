import { z } from 'zod';
import { randomUUID } from 'crypto';
import { router, protectedProcedure } from '../trpc';
import { getGatewayBridge } from '../gateway/bridge';
import { ChatHistoryResponseSchema, SessionsListResponseSchema } from '../gateway/types';

export const sessionsRouter = router({
  list: protectedProcedure.query(async () => {
    const bridge = getGatewayBridge();
    const result = await bridge.request<unknown>('sessions.list', {});
    return SessionsListResponseSchema.parse(result);
  }),

  history: protectedProcedure
    .input(z.object({ sessionKey: z.string(), limit: z.number().int().min(1).max(500).default(100) }))
    .query(async ({ input }) => {
      const bridge = getGatewayBridge();
      const result = await bridge.request<unknown>('chat.history', {
        sessionKey: input.sessionKey,
        limit: input.limit,
      });
      return ChatHistoryResponseSchema.parse(result);
    }),

  send: protectedProcedure
    .input(z.object({
      sessionKey: z.string(),
      message: z.string().min(1),
      idempotencyKey: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const bridge = getGatewayBridge();
      const result = await bridge.request<{ runId: string; status: string }>('chat.send', {
        sessionKey: input.sessionKey,
        message: input.message,
        idempotencyKey: input.idempotencyKey ?? randomUUID(),
      });
      return result;
    }),
});
