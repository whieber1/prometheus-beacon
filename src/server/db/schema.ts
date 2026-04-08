import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color').notNull().default('#58a6ff'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const stories = sqliteTable('stories', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id),
  storyId: text('story_id').notNull(),  // e.g. "US-001"
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('todo'),       // todo|in_progress|blocked|done
  priority: text('priority').notNull().default('medium'), // low|medium|high
  assignedAgent: text('assigned_agent'),
  blockedReason: text('blocked_reason'),
  labels: text('labels').notNull().default('[]'),         // JSON array of label names
  position: real('position').notNull().default(0),
  sessionKey: text('session_key'),                        // linked gateway session
  dispatchedAt: integer('dispatched_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const labels = sqliteTable('labels', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#58a6ff'),
});
