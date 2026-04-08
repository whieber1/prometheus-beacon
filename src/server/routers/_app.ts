import { router } from '../trpc';
import { projectsRouter } from './projects';
import { agentsRouter } from './agents';
import { sessionsRouter } from './sessions';
import { approvalsRouter } from './approvals';
import { cronRouter } from './cron';
import { filesRouter } from './files';
import { metricsRouter } from './metrics';

export const appRouter = router({
  projects: projectsRouter,
  agents: agentsRouter,
  sessions: sessionsRouter,
  approvals: approvalsRouter,
  cron: cronRouter,
  files: filesRouter,
  metrics: metricsRouter,
});

export type AppRouter = typeof appRouter;
