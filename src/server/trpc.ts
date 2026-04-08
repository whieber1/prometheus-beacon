import { initTRPC, TRPCError } from '@trpc/server';
import { getSession } from '@/lib/auth';
import { db } from './db';

export const createTRPCContext = async () => {
  const session = await getSession();
  return { session, db };
};

const t = initTRPC.context<typeof createTRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session.isLoggedIn) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx });
});
