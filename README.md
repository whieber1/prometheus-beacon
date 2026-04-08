# Prometheus Beacon

Web dashboard for the [Prometheus](https://github.com/whieber1/prometheus) sovereign AI agent.

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

## Architecture

Beacon is a Next.js dashboard that connects to a running Prometheus instance via FastAPI (REST on port 8005) and WebSocket (live events on port 8010).

```
Prometheus Process
  FastAPI :8005  <- REST (status, telemetry, config, skills)
  WebSocket :8010 <- Live events (tool calls, agent state, sessions)
        |
  Beacon Dashboard (Next.js :3002)
    gateway-store  <- Zustand store holding all live state
    Pages          <- Read from store + REST fetch on mount
```

In production, Prometheus serves the built static files directly -- no separate Node process needed.

## Development

```bash
npm run dev    # Start dev server with hot reload
npm run build  # Production build
npm start      # Start production server
```

## License

MIT
