import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { projects, stories } from '../db/schema';
import { eq, asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { getGatewayBridge } from '../gateway/bridge';

const storiesRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (input?.projectId) {
        return ctx.db.select().from(stories).where(eq(stories.projectId, input.projectId)).orderBy(asc(stories.position));
      }
      return ctx.db.select().from(stories).orderBy(asc(stories.position));
    }),

  history: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const { desc } = await import('drizzle-orm');
      return ctx.db.select().from(stories).orderBy(desc(stories.updatedAt)).limit(input?.limit ?? 50);
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string().optional(),
      storyId: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
      status: z.enum(['todo', 'in_progress', 'blocked', 'done']).default('todo'),
      priority: z.enum(['low', 'medium', 'high']).default('medium'),
      assignedAgent: z.string().optional(),
      blockedReason: z.string().optional(),
      labels: z.array(z.string()).default([]),
      position: z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const id = randomUUID();
      await ctx.db.insert(stories).values({
        id,
        projectId: input.projectId ?? null,
        storyId: input.storyId,
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        priority: input.priority,
        assignedAgent: input.assignedAgent ?? null,
        blockedReason: input.blockedReason ?? null,
        labels: JSON.stringify(input.labels),
        position: input.position,
        createdAt: now,
        updatedAt: now,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().min(1).optional(),
      description: z.string().optional().nullable(),
      status: z.enum(['todo', 'in_progress', 'blocked', 'done']).optional(),
      priority: z.enum(['low', 'medium', 'high']).optional(),
      assignedAgent: z.string().optional().nullable(),
      blockedReason: z.string().optional().nullable(),
      labels: z.array(z.string()).optional(),
      position: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, labels, ...rest } = input;
      const updateData: Record<string, unknown> = {
        ...rest,
        updatedAt: new Date(),
      };
      if (labels !== undefined) {
        updateData.labels = JSON.stringify(labels);
      }
      await ctx.db.update(stories).set(updateData).where(eq(stories.id, id));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(stories).where(eq(stories.id, input.id));
      return { success: true };
    }),

  dispatch: protectedProcedure
    .input(z.object({
      id: z.string(),
      sessionKey: z.string(), // target session to send the task to
    }))
    .mutation(async ({ ctx, input }) => {
      const [story] = await ctx.db.select().from(stories).where(eq(stories.id, input.id)).limit(1);
      if (!story) throw new Error('Story not found');

      const taskMessage = [
        `**Task: ${story.title}**`,
        story.description ? `\n${story.description}` : '',
        `\n_Task ID: ${story.storyId}_`,
      ].filter(Boolean).join('');

      const bridge = getGatewayBridge();
      await bridge.request('chat.send', {
        sessionKey: input.sessionKey,
        message: taskMessage,
        idempotencyKey: randomUUID(),
      });

      const now = new Date();
      await ctx.db.update(stories).set({
        sessionKey: input.sessionKey,
        status: 'in_progress',
        dispatchedAt: now,
        updatedAt: now,
      }).where(eq(stories.id, input.id));

      return { success: true, sessionKey: input.sessionKey };
    }),

  undispatch: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(stories).set({
        sessionKey: null,
        dispatchedAt: null,
        status: 'todo',
        updatedAt: new Date(),
      }).where(eq(stories.id, input.id));
      return { success: true };
    }),

  reorder: protectedProcedure
    .input(z.array(z.object({ id: z.string(), position: z.number(), status: z.enum(['todo', 'in_progress', 'blocked', 'done']) })))
    .mutation(async ({ ctx, input }) => {
      for (const item of input) {
        await ctx.db.update(stories)
          .set({ position: item.position, status: item.status, updatedAt: new Date() })
          .where(eq(stories.id, item.id));
      }
      return { success: true };
    }),
});

export const projectsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(projects).orderBy(asc(projects.createdAt));
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      color: z.string().default('#58a6ff'),
    }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const id = randomUUID();
      await ctx.db.insert(projects).values({
        id,
        name: input.name,
        description: input.description ?? null,
        color: input.color,
        createdAt: now,
        updatedAt: now,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      description: z.string().optional().nullable(),
      color: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      await ctx.db.update(projects).set({ ...rest, updatedAt: new Date() }).where(eq(projects.id, id));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(projects).where(eq(projects.id, input.id));
      return { success: true };
    }),

  stories: storiesRouter,
});
