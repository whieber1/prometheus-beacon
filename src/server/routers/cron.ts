import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { getGatewayBridge } from '../gateway/bridge';

export const cronRouter = router({
  list: protectedProcedure
    .input(z.object({ agentId: z.string().optional() }))
    .query(async ({ input }) => {
      const bridge = getGatewayBridge();
      const result = await bridge.request<unknown>('cron.list', input.agentId ? { agentId: input.agentId } : {});
      return result as { jobs: Array<{ id: string; schedule: string; task: string; agentId?: string; enabled?: boolean; lastRunAt?: number; nextRunAt?: number }> };
    }),

  status: protectedProcedure
    .input(z.object({ agentId: z.string().optional() }))
    .query(async ({ input }) => {
      const bridge = getGatewayBridge();
      const result = await bridge.request<unknown>('cron.status', input.agentId ? { agentId: input.agentId } : {});
      return result;
    }),

  add: protectedProcedure
    .input(z.object({
      agentId: z.string().optional(),
      schedule: z.string(),
      task: z.string(),
      label: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const bridge = getGatewayBridge();
      const result = await bridge.request<{ id: string }>('cron.add', input);
      return result;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      schedule: z.string().optional(),
      task: z.string().optional(),
      label: z.string().optional(),
      enabled: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const bridge = getGatewayBridge();
      await bridge.request('cron.update', input);
      return { ok: true };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const bridge = getGatewayBridge();
      await bridge.request('cron.remove', { id: input.id });
      return { ok: true };
    }),

  run: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const bridge = getGatewayBridge();
      const result = await bridge.request<{ runId: string }>('cron.run', { id: input.id });
      return result;
    }),

  runs: protectedProcedure
    .input(z.object({ id: z.string(), limit: z.number().int().min(1).max(100).default(20) }))
    .query(async ({ input }) => {
      const bridge = getGatewayBridge();
      const result = await bridge.request<unknown>('cron.runs', { id: input.id, limit: input.limit });
      return result as { runs: Array<{ runId: string; startedAt: number; finishedAt?: number; status: string }> };
    }),
});
