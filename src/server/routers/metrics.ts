import { router, protectedProcedure } from '../trpc';
import { getGatewayBridge } from '../gateway/bridge';
import { SessionsListResponseSchema } from '../gateway/types';
import os from 'os';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

export const metricsRouter = router({
  sessions: protectedProcedure.query(async () => {
    const bridge = getGatewayBridge();
    const result = await bridge.request<unknown>('sessions.list', {});
    const data = SessionsListResponseSchema.parse(result);
    const sessions = data.sessions;

    // Aggregate token usage
    let totalInput = 0;
    let totalOutput = 0;
    let totalTokens = 0;

    const byModel: Record<string, { sessions: number; input: number; output: number; total: number }> = {};
    const byAgent: Record<string, { sessions: number; tokens: number }> = {};

    for (const s of sessions) {
      const inp = s.inputTokens ?? 0;
      const out = s.outputTokens ?? 0;
      const tot = s.totalTokens ?? (inp + out);
      totalInput += inp;
      totalOutput += out;
      totalTokens += tot;

      const model = s.model ?? s.modelProvider ?? 'unknown';
      if (!byModel[model]) byModel[model] = { sessions: 0, input: 0, output: 0, total: 0 };
      byModel[model].sessions++;
      byModel[model].input += inp;
      byModel[model].output += out;
      byModel[model].total += tot;

      // Extract agent from session key: agent:<agentId>:...
      const agentId = s.key?.split(':')?.[1] ?? 'unknown';
      if (!byAgent[agentId]) byAgent[agentId] = { sessions: 0, tokens: 0 };
      byAgent[agentId].sessions++;
      byAgent[agentId].tokens += tot;
    }

    // Estimated cost (Anthropic pricing, rough)
    const COST_PER_MTok: Record<string, { in: number; out: number }> = {
      'anthropic/claude-sonnet-4-5': { in: 3.0, out: 15.0 },
      'anthropic/claude-haiku-4-5': { in: 0.25, out: 1.25 },
      'anthropic/claude-opus-4-6': { in: 15.0, out: 75.0 },
    };

    let estimatedCostUSD = 0;
    for (const [model, usage] of Object.entries(byModel)) {
      const pricing = COST_PER_MTok[model];
      if (pricing) {
        estimatedCostUSD += (usage.input / 1_000_000) * pricing.in;
        estimatedCostUSD += (usage.output / 1_000_000) * pricing.out;
      }
    }

    return {
      sessionCount: sessions.length,
      totalInput,
      totalOutput,
      totalTokens,
      estimatedCostUSD,
      byModel: Object.entries(byModel)
        .map(([model, v]) => ({ model, ...v }))
        .sort((a, b) => b.total - a.total),
      byAgent: Object.entries(byAgent)
        .map(([agent, v]) => ({ agent, ...v }))
        .sort((a, b) => b.tokens - a.tokens),
      sessions: sessions
        .filter(s => (s.totalTokens ?? 0) > 0)
        .map(s => ({
          key: s.key,
          label: s.label ?? s.key,
          model: s.model,
          inputTokens: s.inputTokens ?? 0,
          outputTokens: s.outputTokens ?? 0,
          totalTokens: s.totalTokens ?? 0,
          updatedAt: s.updatedAt,
        }))
        .sort((a, b) => (b.totalTokens) - (a.totalTokens))
        .slice(0, 20),
    };
  }),

  toolCallHistory: protectedProcedure.query(async () => {
    const telemetryPath = path.join(os.homedir(), '.prometheus', 'telemetry.db');
    if (!fs.existsSync(telemetryPath)) {
      return { calls: [], total: 0 };
    }
    try {
      const db = new Database(telemetryPath, { readonly: true });
      const rows = db.prepare(
        `SELECT id, timestamp, model, tool_name, success, retries, latency_ms, error_type, error_detail
         FROM tool_calls
         WHERE tool_name IS NOT NULL AND tool_name != '' AND tool_name != '_loop_transition'
         ORDER BY timestamp DESC
         LIMIT 200`
      ).all() as Array<{
        id: number;
        timestamp: number;
        model: string;
        tool_name: string;
        success: number;
        retries: number;
        latency_ms: number;
        error_type: string | null;
        error_detail: string | null;
      }>;
      db.close();

      const calls = rows.map((r) => ({
        call_id: `hist-${r.id}`,
        tool_name: r.tool_name,
        success: r.success === 1,
        error: r.error_detail || r.error_type || undefined,
        latency_ms: r.latency_ms || 0,
        started_at: r.timestamp,
      }));
      return { calls, total: calls.length };
    } catch {
      return { calls: [], total: 0 };
    }
  }),

  system: protectedProcedure.query(async () => {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const loadAvg = os.loadavg();
    const uptime = os.uptime();

    // Disk usage for workspace
    let diskFree = 0;
    let diskTotal = 0;
    try {
      const { execSync } = await import('child_process');
      const dfOut = execSync("df -k /home --output=size,avail 2>/dev/null | tail -1", { timeout: 2000 }).toString().trim();
      const [size, avail] = dfOut.split(/\s+/).map(Number);
      diskTotal = size * 1024;
      diskFree = avail * 1024;
    } catch { /* non-critical */ }

    // Process info
    const processUptime = process.uptime();

    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      cpuModel: cpus[0]?.model ?? 'Unknown',
      cpuCount: cpus.length,
      loadAvg1: loadAvg[0],
      loadAvg5: loadAvg[1],
      loadAvg15: loadAvg[2],
      totalMemBytes: totalMem,
      usedMemBytes: usedMem,
      freeMemBytes: freeMem,
      memPercent: Math.round((usedMem / totalMem) * 100),
      diskTotalBytes: diskTotal,
      diskFreeBytes: diskFree,
      diskUsedPercent: diskTotal > 0 ? Math.round(((diskTotal - diskFree) / diskTotal) * 100) : 0,
      systemUptime: uptime,
      processUptime,
    };
  }),
});
