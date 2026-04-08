import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { getGatewayBridge } from '../gateway/bridge';
import { getRemoteGateways } from '../gateway/remote-bridges';
import { AgentsListResponseSchema, SessionsListResponseSchema } from '../gateway/types';
import fs from 'fs';
import path from 'path';
import os from 'os';

const PRESET_MODELS: Record<string, string> = {
  research:    'ollama/llama3.3:latest',
  engineer:    'ollama/qwen2.5-coder:32b',
  growth:      'anthropic/claude-sonnet-4-5',
  coordinator: 'anthropic/claude-sonnet-4-5',
  pr:          'ollama/qwen2.5-coder:32b',
  blank:       'anthropic/claude-sonnet-4-5',
};

const PRESET_DESCRIPTIONS: Record<string, string> = {
  research:    'Research analyst — searches, reads, and synthesizes information.',
  engineer:    'Autonomous engineer — writes code, runs tests, commits, and deploys.',
  growth:      'Growth operator — manages outreach, tracks metrics, automates marketing.',
  coordinator: 'Coordinator — spawns and orchestrates other agents for complex tasks.',
  pr:          'PR engineer — reviews PRs, writes docs, manages GitHub workflows.',
  blank:       'General purpose agent.',
};

export const agentsRouter = router({
  list: protectedProcedure.query(async () => {
    const bridge = getGatewayBridge();
    const result = await bridge.request<unknown>('agents.list', {});
    const local = AgentsListResponseSchema.parse(result);

    // Merge remote gateway agents
    const remotes = getRemoteGateways();
    for (const rg of remotes) {
      if (!rg.isConnected) {
        // Add placeholder for offline remote
        local.agents.push({ id: `${rg.name.toLowerCase()}:offline`, label: `${rg.name} (offline)`, model: 'disconnected' });
        continue;
      }
      try {
        const remote = await rg.request<unknown>('agents.list', {});
        const parsed = AgentsListResponseSchema.parse(remote);
        for (const agent of parsed.agents) {
          local.agents.push({
            ...agent,
            id: `${rg.name.toLowerCase()}:${agent.id}`,
            label: `${agent.label ?? agent.id} (${rg.name})`,
            description: agent.description ?? `Remote agent on ${rg.host}`,
          });
        }
      } catch (err) {
        console.warn(`[AgentsRouter] Failed to fetch agents from ${rg.name}:`, (err as Error).message);
        local.agents.push({ id: `${rg.name.toLowerCase()}:error`, label: `${rg.name} (error)`, model: 'unreachable' });
      }
    }

    return local;
  }),

  sessions: protectedProcedure.query(async () => {
    const bridge = getGatewayBridge();
    const result = await bridge.request<unknown>('sessions.list', {});
    const local = SessionsListResponseSchema.parse(result);

    // Merge remote sessions
    const remotes = getRemoteGateways();
    for (const rg of remotes) {
      if (!rg.isConnected) continue;
      try {
        const remote = await rg.request<unknown>('sessions.list', {});
        const parsed = SessionsListResponseSchema.parse(remote);
        for (const session of parsed.sessions) {
          local.sessions.push({
            ...session,
            key: `${rg.name.toLowerCase()}:${session.key}`,
            label: session.label ? `${session.label} (${rg.name})` : `${rg.name}:${session.key}`,
          });
        }
      } catch {}
    }

    return local;
  }),

  sessionTree: protectedProcedure.query(async () => {
    const bridge = getGatewayBridge();
    const result = await bridge.request<{ sessions: Array<{ key: string; label?: string; model?: string }> }>('sessions.list', {});
    const sessions = result.sessions ?? [];

    // Build tree: sessions with key "agent:main:main" are roots
    // Sessions with key "agent:main:subagent:*" are children of main
    type TreeNode = {
      key: string;
      label?: string;
      model?: string;
      children: TreeNode[];
    };

    const roots: TreeNode[] = [];
    const byKey = new Map<string, TreeNode>();

    for (const s of sessions) {
      byKey.set(s.key, { key: s.key, label: s.label, model: s.model, children: [] });
    }

    for (const [key, node] of byKey) {
      // Determine parent key: subagents have keys like "agent:main:subagent:uuid"
      if (key.includes(':subagent:')) {
        const parts = key.split(':');
        // Parent would be "agent:main:main" for first-level subagents
        const parentKey = parts.slice(0, 3).join(':') + ':' + 'main';
        const parent = byKey.get(parentKey);
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    }

    return { roots, all: sessions };
  }),

  getSettings: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ input }) => {
      const bridge = getGatewayBridge();
      const config = await bridge.request<Record<string, unknown>>('config.get', {});
      const agents = config?.agents as Record<string, unknown> | undefined;
      return { agentId: input.agentId, settings: agents ?? {} };
    }),

  create: protectedProcedure
    .input(z.object({
      id: z.string().min(1).max(32).regex(/^[a-z0-9-]+$/, 'lowercase, numbers, hyphens only'),
      name: z.string().min(1).max(64),
      preset: z.string().default('blank'),
      controlLevel: z.enum(['conservative', 'balanced', 'autopilot']).default('balanced'),
      firstTask: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const bridge = getGatewayBridge();

      // 1. Create workspace directory
      const workspaceBase = path.join(os.homedir(), '.prometheus');
      const workspaceDir = path.join(workspaceBase, `workspace-${input.id}`);
      if (!fs.existsSync(workspaceDir)) {
        fs.mkdirSync(workspaceDir, { recursive: true });
        fs.mkdirSync(path.join(workspaceDir, 'memory'), { recursive: true });
      }

      // 2. Write IDENTITY.md
      const identityContent = `# IDENTITY.md\n\n- **Name:** ${input.name}\n- **Role:** ${PRESET_DESCRIPTIONS[input.preset] ?? 'General purpose agent'}\n- **Created:** ${new Date().toISOString().split('T')[0]}\n`;
      fs.writeFileSync(path.join(workspaceDir, 'IDENTITY.md'), identityContent);

      // 3. Write SOUL.md
      const soulContent = `# SOUL.md\n\nBe genuinely helpful. Have opinions. Be resourceful before asking.\n\n**Specialty:** ${PRESET_DESCRIPTIONS[input.preset] ?? 'General purpose'}\n`;
      fs.writeFileSync(path.join(workspaceDir, 'SOUL.md'), soulContent);

      // 4. Build agent config entry
      const primaryModel = PRESET_MODELS[input.preset] ?? 'anthropic/claude-sonnet-4-5';
      const toolRestrictions = input.controlLevel === 'conservative'
        ? { allow: ['read', 'memory_search', 'memory_get', 'web_search', 'web_fetch'] }
        : input.controlLevel === 'autopilot'
        ? {}
        : { deny: [] as string[] }; // balanced = all tools, no restrictions

      const newAgent: Record<string, unknown> = {
        id: input.id,
        name: input.name,
        workspace: workspaceDir,
        model: { primary: primaryModel },
        ...(Object.keys(toolRestrictions).length > 0 ? { tools: toolRestrictions } : {}),
      };

      // 5. Get current config, merge agents.list
      const configResult = await bridge.request<{ parsed?: { agents?: { list?: unknown[] } } }>('config.get', {});
      const currentList: unknown[] = (configResult as Record<string, unknown>)?.parsed
        ? ((configResult as Record<string, unknown>).parsed as Record<string, unknown>)?.agents
          ? (((configResult as Record<string, unknown>).parsed as Record<string, unknown>).agents as Record<string, unknown>)?.list as unknown[] ?? []
          : []
        : [];

      // Avoid duplicates
      const filtered = currentList.filter((a: unknown) => (a as Record<string, unknown>).id !== input.id);
      const updatedList = [...filtered, newAgent];

      await bridge.request('config.patch', {
        agents: { list: updatedList },
      });

      // 6. Restart gateway to pick up new agent
      await bridge.request('gateway.restart', { reason: `New agent created: ${input.id}` }).catch(() => {
        // restart may not return a response — that's expected
      });

      return { success: true, agentId: input.id, workspaceDir };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const bridge = getGatewayBridge();

      const configResult = await bridge.request<Record<string, unknown>>('config.get', {});
      const currentList: unknown[] = (configResult?.parsed as Record<string, unknown>)?.agents
        ? ((configResult.parsed as Record<string, unknown>).agents as Record<string, unknown>)?.list as unknown[] ?? []
        : [];

      const updatedList = currentList.filter((a: unknown) => (a as Record<string, unknown>).id !== input.id);

      await bridge.request('config.patch', { agents: { list: updatedList } });
      await bridge.request('gateway.restart', { reason: `Agent deleted: ${input.id}` }).catch(() => {});

      return { success: true };
    }),
});
