import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { getGatewayBridge } from '../gateway/bridge';
import { ApprovalDecisionSchema } from '../gateway/types';

export const approvalsRouter = router({
  get: protectedProcedure.query(async () => {
    const bridge = getGatewayBridge();
    const result = await bridge.request<{
      file?: {
        version: number;
        socket?: { path: string };
        defaults: Record<string, unknown>;
        agents: Record<string, unknown>;
      };
      exists?: boolean;
    }>('exec.approvals.get', {});
    return result;
  }),

  resolve: protectedProcedure
    .input(z.object({
      id: z.string(),
      decision: ApprovalDecisionSchema,
    }))
    .mutation(async ({ input }) => {
      const bridge = getGatewayBridge();
      await bridge.request('exec.approval.resolve', {
        id: input.id,
        decision: input.decision,
      });
      return { ok: true };
    }),
});
