# Prometheus Beacon

**Mission control dashboard for the [Prometheus](https://github.com/whieber1/Prometheus-) sovereign AI agent.**

Real-time visibility into your agent — tool calls, sessions, metrics, skills, and context health — via a live WebSocket connection. No polling.

![Beacon Login](public/logo-transparent.png)

---

## What It Does

Beacon connects to a running Prometheus instance and gives you a live dashboard:

- **Tool Call Feed** — every tool invocation in real time, with inputs, outputs, latency, and success/fail status
- **Agent Status** — current state (thinking / running / idle / dreaming), model, provider, profile, uptime
- **Sessions** — active conversation sessions with live updates
- **Metrics** — per-tool telemetry: call counts, success rates, retries, average latency
- **Skills** — loaded skills with source badges (builtin / user / auto)
- **Activity Feed** — all gateway events in a unified timeline
- **Context Health** — LCM token usage, compression ratio, fresh vs summary message counts
- **File Browser** — workspace file navigation via tRPC

Data flows through a Zustand store fed by WebSocket events — pages are reactive and update instantly.

---

## Quick Start

```bash
git clone https://github.com/whieber1/prometheus-beacon.git
cd prometheus-beacon
cp .env.example .env.local
# Edit .env.local with your values
npm install
npm run build
npm start
```

Open `http://localhost:3002` and log in with the credentials you set in `.env.local`.

**Prerequisites:**
- Node.js 18+
- A running Prometheus instance (FastAPI on `:8005`, WebSocket on `:8010`)

---

## Configuration

All configuration is via environment variables. See `.env.example` for the full list.

**Required:**

| Variable | Description |
|----------|-------------|
| `MC_USERNAME` | Dashboard login username |
| `MC_PASSWORD` | Dashboard login password |
| `SESSION_SECRET` | Random string for session signing (32+ chars) |

**Optional:**

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_BASE` | `http://localhost:8005` | Prometheus FastAPI URL |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:8010` | Prometheus WebSocket URL |
| `PROMETHEUS_GATEWAY_URL` | `ws://localhost:8010` | Gateway bridge connection |
| `PROMETHEUS_GATEWAY_TOKEN` | _(empty)_ | Gateway auth token |
| `WORKSPACE_ROOT` | `~/.prometheus/workspace` | Agent workspace directory |
| `PORT` | `3002` | Dashboard server port |

Generate a session secret:
```bash
openssl rand -hex 32
```

---

## Architecture

```
┌─ Prometheus Process ─────────────────────────────────┐
│  FastAPI :8005  ← REST (status, telemetry, config)   │
│  WebSocket :8010 ← Live events (tool calls, state)   │
└──────────┬────────────────────┬──────────────────────┘
           │ REST               │ WS
           ▼                    ▼
┌─ Beacon Dashboard (Next.js :3002) ───────────────────┐
│  gateway-store   → Zustand store holds all live state │
│  use-gateway.ts  → WebSocket client, auto-reconnect  │
│  Pages           → read from store + REST fetch       │
│  tRPC            → file browser, auth, server routes  │
└──────────────────────────────────────────────────────┘
```

**In production**, Prometheus serves the built static files directly from its FastAPI server — no separate Node process needed. For development, run `npm run dev` for hot reload on `:3002`.

### Key Files

| Path | Purpose |
|------|---------|
| `src/lib/stores/gateway-store.ts` | Zustand store — all live state from WebSocket events |
| `src/lib/hooks/use-gateway.ts` | WebSocket client with reconnection logic |
| `src/lib/config.ts` | API/WS URL resolution (env vars → origin fallback) |
| `src/server/gateway/bridge.ts` | Server-side gateway bridge to Prometheus |
| `server.ts` | Custom Next.js server with WebSocket proxy |

### Pages

| Route | View |
|-------|------|
| `/` | Dashboard overview — tool calls, agent state, activity, context % |
| `/projects` | Live tool call feed with filtering |
| `/agents` | Agent status, profiles, LCM context bar |
| `/sessions` | Active sessions list |
| `/metrics` | Per-tool telemetry table |
| `/tools` | Skills list with source badges |
| `/files` | Workspace file browser |
| `/activity` | Unified event feed |

---

## Development

```bash
npm run dev    # Start dev server with hot reload
npm run build  # Production build
npm start      # Start production server
```

---

## Remote Gateways

Beacon can connect to multiple Prometheus instances across machines. Set the `REMOTE_GATEWAYS` env var:

```bash
# Format: name|host|ws-url|token (comma-separated for multiple)
REMOTE_GATEWAYS=gpu-node|gpu-node|ws://192.168.1.100:18789|your-token
```

---

## Tech Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Zustand** (state management)
- **tRPC** (server routes)
- **Drizzle ORM** + SQLite (local data)
- **iron-session** (auth)
- **Tailwind CSS**

---

## License

MIT

---

## Credits

Built by [Will Hieber](https://github.com/whieber1) / OAra Labs.

Beacon is the web dashboard companion to [Prometheus](https://github.com/whieber1/Prometheus-). The agent does the work — Beacon lets you watch.
