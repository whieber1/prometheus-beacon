import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';
// Load .env.local before anything else (override=true so it wins over system env)
loadDotenv({ path: resolve(process.cwd(), '.env.local'), override: true });

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import { initGatewayBridge } from './src/server/gateway/bridge';
import { initRemoteGateways } from './src/server/gateway/remote-bridges';
import type { ClientMessage, BrowserMessage } from './src/server/gateway/types';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3002', 10);
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // ─── Browser WebSocket server ─────────────────────────────────────────────
  const wss = new WebSocketServer({ server, path: '/ws' });
  const clients = new Set<WebSocket>();

  function broadcast(msg: BrowserMessage): void {
    const data = JSON.stringify(msg);
    clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    });
  }

  // Store broadcast globally for use in tRPC context etc.
  (global as Record<string, unknown>)['broadcast'] = broadcast;

  // ─── Gateway Bridge ───────────────────────────────────────────────────────
  const bridge = initGatewayBridge();
  initRemoteGateways();

  // Forward all gateway events to browser clients
  bridge.subscribe((event) => {
    broadcast({ type: 'gateway_event', event });

    // Also emit specific typed messages based on event type
    if (event.event === 'sessions.updated' || event.event === 'sessions.list') {
      const payload = event.payload as { sessions?: import('./src/server/gateway/types').Session[] } | undefined;
      if (Array.isArray(payload?.sessions)) {
        broadcast({ type: 'sessions_snapshot', sessions: payload.sessions! });
      }
    }

    if (event.event === 'exec.approval.request') {
      const approval = event.payload as import('./src/server/gateway/types').ExecApprovalRequest | undefined;
      if (approval?.id) broadcast({ type: 'approval_request', approval });
    }
  });

  // Broadcast gateway state changes
  bridge.onStateChange((state) => {
    if (state === 'connected') broadcast({ type: 'gateway_connected' });
    else if (state === 'reconnecting') broadcast({ type: 'gateway_reconnecting', attempt: 1 });
    else if (state === 'idle' || state === 'failed') broadcast({ type: 'gateway_disconnected' });
  });

  // ─── Browser client connections ───────────────────────────────────────────
  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`[WS] Browser client connected (total: ${clients.size})`);

    // Send welcome + current state
    ws.send(JSON.stringify({ type: 'welcome', message: 'Mission Control v2 connected' } satisfies BrowserMessage));

    const state = bridge.getState();
    if (state === 'connected') {
      ws.send(JSON.stringify({ type: 'gateway_connected' } satisfies BrowserMessage));

      // Send current sessions snapshot
      const sessions = bridge.getCachedSessions();
      if (sessions.length > 0) {
        ws.send(JSON.stringify({ type: 'sessions_snapshot', sessions } satisfies BrowserMessage));
      }
    } else if (state === 'reconnecting') {
      ws.send(JSON.stringify({ type: 'gateway_reconnecting', attempt: 1 } satisfies BrowserMessage));
    } else {
      ws.send(JSON.stringify({ type: 'gateway_disconnected' } satisfies BrowserMessage));
    }

    ws.on('message', async (data) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(data.toString()) as ClientMessage;
      } catch {
        console.warn('[WS] Invalid message from browser client');
        return;
      }

      try {
        if (msg.type === 'send_message') {
          await bridge.request('chat.send', {
            sessionKey: msg.sessionKey,
            message: msg.message,
            idempotencyKey: msg.idempotencyKey,
          });
        } else if (msg.type === 'resolve_approval') {
          await bridge.request('exec.approval.resolve', {
            id: msg.id,
            decision: msg.decision,
          });
        }
      } catch (err) {
        console.error('[WS] Gateway request failed:', (err as Error).message);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[WS] Browser client disconnected (total: ${clients.size})`);
    });

    ws.on('error', (err) => {
      console.error('[WS] Error:', err.message);
    });
  });

  server.listen(port, () => {
    console.log(`\n> Mission Control v2 ready on http://localhost:${port}`);
    console.log(`> WebSocket server at ws://localhost:${port}/ws`);
    console.log(`> Gateway bridge connecting to ${process.env.PROMETHEUS_GATEWAY_URL}`);
    console.log(`> Environment: ${dev ? 'development' : 'production'}\n`);
  });
});
