# Beacon — Prometheus Integration Spec

## Overview

Beacon rewires the existing Control-v2 dashboard to use Prometheus as its
data source. The visual language, component library, and
page structure are preserved — only data sources change.

## Architecture

```
┌─ Prometheus Process ─────────────────────────────────┐
│  FastAPI :8005  ← REST (status, telemetry, config)   │
│  WebSocket :8010 ← Live events (tool calls, state)   │
└──────────┬────────────────────┬──────────────────────┘
           │ REST               │ WS
           ▼                    ▼
┌─ Browser (Next.js) ──────────────────────────────────┐
│  use-gateway.ts    → connects to ws://host:8010      │
│  gateway-store.ts  → Zustand store holds all state   │
│  Pages             → read from store + REST fetch    │
└──────────────────────────────────────────────────────┘
```

## Page Mapping (Control-v2 → Prometheus)

| Existing Page | New Purpose | Data Source |
|---------------|-------------|-------------|
| Dashboard `/` | Overview stats | Gateway store (toolCalls, status, lcm, activity) |
| Projects `/projects` | **Tool Call Feed** | Gateway store `toolCalls[]` from WS events |
| Agents `/agents` | **Agent Status** | REST `/api/status`, `/api/profiles`; WS `agent_state` |
| Sessions `/sessions` | Session list | Gateway store `sessions{}` from WS `session_list` |
| Metrics `/metrics` | **Telemetry** | REST `/api/telemetry`; store `lcmState`, `prometheusStatus` |
| Tools `/tools` | **Skills & Config** | REST `/api/skills`; existing tools kept |
| Files `/files` | File browser | Unchanged (tRPC) |
| Activity `/activity` | Event feed | Gateway store `activityFeed[]` (all events) |

## Sidebar Changes

- "Agents" section → "Sessions" (reads from store)
- Nav labels: Projects→"Tool Calls", Agents→"Agent Status", Tools→"Skills"
- Subtitle: "Prometheus Command Center"

## WebSocket Event Flow (port 8010)

Browser connects directly to Prometheus WS. Event envelope:

```json
{ "type": "agent_state", "timestamp": 1712456789.0, "payload": { "state": "thinking" } }
```

Events handled by `handlePrometheusEvent()` in gateway-store:
- `agent_state` → updates `prometheusStatus`
- `chat_message`, `chat_delta`, `chat_done` → updates `chatMessages`, `streamingContent`
- `tool_call_start`, `tool_call_end` → updates `toolCalls[]`
- `lcm_update` → updates `lcmState`
- `sentinel_signal`, `dream_*` → updates `sentinelState`
- `session_list` → updates `sessions{}`
- All events → added to `activityFeed[]`

## REST Endpoints (port 8005)

Pages fetch from these on mount:
- `GET /api/status` — agent state, model, provider, profile, uptime
- `GET /api/telemetry` — per-tool success rates, latency, retries
- `GET /api/skills` — loaded skill list with source badges
- `GET /api/profiles` — profile list with active indicator
- `GET /api/sessions` — session list
- `GET /api/config` — sanitized YAML
- `GET /api/wiki/stats` — page count, entity breakdown
- `GET /api/sentinel` — SENTINEL state, dream log
- `GET /api/lcm/{session_id}` — context window state

## Prometheus Web Bridge (new files in prometheus-build/Prometheus)

- `src/prometheus/web/server.py` — FastAPI app with all REST routes
- `src/prometheus/web/ws_server.py` — WebSocket bridge (SignalBus → browser)
- `src/prometheus/web/launcher.py` — starts both servers

## Constraints

- **No new pages** — modify existing pages only
- **Visual language preserved** — same colors, card components, layout
- **Model-agnostic** — no Anthropic API references in UI
- **Additive** — existing components kept until replaced
- **Tailscale accessible** — WS/REST URLs derive from `window.location.hostname`
