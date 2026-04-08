# Beacon — Implementation Report

## What Was Built

All modifications were made to existing Control-v2 files. No new pages created. Visual language preserved.

### Gateway Layer (data source rewire)

| File | Change |
|------|--------|
| `src/server/gateway/types.ts` | Added Prometheus type definitions: PrometheusEvent, PrometheusToolCall, PrometheusLCMState, PrometheusSentinelState, PrometheusStatus, PrometheusSkill, PrometheusProfile, PrometheusTelemetry, PrometheusWikiStats |
| `src/lib/stores/gateway-store.ts` | Added Prometheus state fields (toolCalls, lcmState, sentinelState, prometheusStatus, skills, profiles, telemetry, wikiStats, chatMessages, streamingContent). Added `handlePrometheusEvent()` dispatcher for all WS event types. Updated `categorizeEvent()` for Prometheus event names. |
| `src/lib/hooks/use-gateway.ts` | Rewired WS URL from `:3002/ws` to `:8010` (Prometheus direct). Message handler now detects Prometheus event format (`{type, timestamp, payload}`) and routes to `handlePrometheusEvent()`, with legacy fallback. |

### Sidebar

| File | Change |
|------|--------|
| `src/components/Sidebar.tsx` | "Agents" section → "Sessions" section reading from gateway store. Nav labels updated: Projects→"Tool Calls", Agents→"Agent Status", Tools→"Skills". Subtitle: "Prometheus Command Center". |

### Pages Modified

| Page | File | Change |
|------|------|--------|
| **Dashboard** | `src/app/(dashboard)/page.tsx` | Converted to client component. Stat cards now show: Tool Calls count, Agent State (with color), Activity count, Context % from LCM. Quick actions updated. |
| **Tool Calls** (was Projects) | `src/app/(dashboard)/projects/page.tsx` | Replaced KanbanBoard with live Tool Call Feed. Shows tool name, latency, success/fail status, expandable inputs/results/errors. Filter by tool name. Stats header with ok/err/running counts. |
| **Agent Status** (was Agents) | `src/app/(dashboard)/agents/page.tsx` | Replaced AgentFleet with Prometheus agent status card: state badge, model, provider, profile, uptime. Profile list with active indicator. LCM context bar. |
| **Metrics** | `src/app/(dashboard)/metrics/page.tsx` | Replaced tRPC queries with gateway store + Prometheus REST fetch. Shows tool telemetry table (calls, success rate, retries, latency per tool), agent status cards, context window health bar. |
| **Sessions** | `src/app/(dashboard)/sessions/page.tsx` | Replaced tRPC query with gateway store read. Sessions now populated from Prometheus WS events. |
| **Skills** (was Tools) | `src/app/(dashboard)/tools/page.tsx` | Added Prometheus skills section (fetched from REST /api/skills). Shows name, description, source badge (builtin/user/auto). |

### Prometheus Web Bridge (in prometheus-build/Prometheus)

| File | Purpose |
|------|---------|
| `src/prometheus/web/__init__.py` | Module marker |
| `src/prometheus/web/server.py` | FastAPI REST (port 8005): 15 endpoints for status, sessions, telemetry, config, skills, profiles, wiki, LCM, sentinel, benchmarks. StaticFiles mount for UI. Config sanitization. |
| `src/prometheus/web/ws_server.py` | WebSocket bridge (port 8010): SignalBus→browser broadcast, client command handler, agent loop runner with streaming. |
| `src/prometheus/web/launcher.py` | Convenience launcher starting both servers as concurrent async tasks. |

### Spec Document

| File | Purpose |
|------|---------|
| `BEACON-SPEC.md` | Full architecture spec, REST API contracts, WS event schema, panel descriptions |

## What Was Skipped / Partial

| Item | Status | Reason |
|------|--------|--------|
| **Static export** | Not applied | Existing app uses server components (auth) and tRPC API routes that require Node. Static export would break auth flow. Deferred until auth is simplified. |
| **Files page** | Unchanged | Still wired to tRPC. Could be rewired to a Prometheus file browser endpoint later. |
| **Activity page** | Unchanged structure | Event categorization updated in store, but page template unchanged — it already works with the activity feed from the store. |
| **Chat panel** | Unchanged | Existing ChatPanel.tsx still wired to tRPC. The gateway store now holds `chatMessages` and `streamingContent` from Prometheus WS — a new chat surface can read from the store. |
| **Benchmark runner UI** | Placeholder only | Prometheus endpoint returns not_implemented. |
| **KanbanBoard.tsx** | Kept in codebase | Not deleted per constraint — the projects page no longer renders it but the component file remains. |

## Prometheus Features Not Yet Surfaced

- [x] **Chat panel (streaming, session switching)** — ⚠️ Partial. Store holds streaming data from WS. Existing ChatPanel still uses tRPC. Data is available, surface not rewired yet.
- [x] **Tool call feed (live, name + inputs + result + latency)** — ✅ Wired. Projects page replaced with live tool call feed reading from `toolCalls` in gateway store.
- [x] **Agent status heartbeat (thinking / running / idle / dreaming / errored)** — ✅ Wired. Agents page shows state badge with animation colors. Dashboard shows state card.
- [x] **SENTINEL state (active / dreaming / last dream cycle)** — ⚠️ Partial. Store has `sentinelState`, REST endpoint exists. No dedicated UI panel yet — sentinel events flow through activity feed.
- [ ] **Kairos idle detection + dream visualization** — ❌ Not connected. Dream events categorized in activity feed but no timeline visualization.
- [x] **LCM context inspector (token count, compression state)** — ✅ Wired. Agents page and Metrics page show context bar, fresh/summary counts, compression ratio from `lcm_update` WS events.
- [x] **Loaded skills display** — ✅ Wired. Tools page fetches from Prometheus REST `/api/skills`, displays with source badges.
- [x] **Active profile indicator + switcher** — ⚠️ Partial. Agents page shows profile list with active highlight. No interactive switch button yet.
- [x] **Telemetry dashboard (success rate per tool, retry rates)** — ✅ Wired. Metrics page shows per-tool table from Prometheus REST `/api/telemetry`.
- [x] **Model + provider display** — ✅ Wired. Dashboard, Agents page, and Sidebar show model/provider from `agent_state` WS events + REST `/api/status`.
- [x] **Config / yaml editor (read-only first)** — ⚠️ Partial. REST endpoint exists with sanitized YAML. No UI surface yet — would be a tab in the Tools/Skills page.
- [x] **Wiki stats (page count, last updated)** — ⚠️ Partial. REST endpoint exists. Store has `wikiStats`. No UI surface yet.
- [ ] **Benchmark runner UI** — ❌ Not connected.

**Summary: 6 ✅ fully wired, 5 ⚠️ partial (data available, surface needed), 2 ❌ not connected.**

## Next Session Starting Point

The gateway layer is fully rewired — Prometheus events flow through the store and pages read from it. The immediate next step is to start the Prometheus web bridge (`launch_web()` in `__main__.py` with `--web` flag) and verify events appear in the UI. After that: (1) rewire the existing ChatPanel to read from the gateway store's `chatMessages`/`streamingContent` instead of tRPC, (2) add a Config/YAML tab to the Tools page, (3) add a SENTINEL panel to the Agents page showing dream cycles, (4) evaluate whether to convert to static export by replacing the server-side auth with a simpler client-side check.
