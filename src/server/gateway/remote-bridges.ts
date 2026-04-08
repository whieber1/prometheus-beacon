import WebSocket from 'ws';
import { randomUUID } from 'crypto';

/**
 * Lightweight bridge for remote Prometheus gateways.
 * Connects, authenticates, and exposes request() — no event subscriptions needed.
 */

interface RemoteGatewayConfig {
  name: string;       // e.g. "Mack"
  host: string;       // e.g. "gpu-node"
  url: string;        // e.g. "ws://192.0.2.1:18789"
  token: string;
}

interface PendingReq {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

class RemoteGateway {
  readonly config: RemoteGatewayConfig;
  private ws: WebSocket | null = null;
  private connected = false;
  private pending = new Map<string, PendingReq>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoff = 2000;

  constructor(config: RemoteGatewayConfig) {
    this.config = config;
  }

  get isConnected(): boolean { return this.connected; }
  get name(): string { return this.config.name; }
  get host(): string { return this.config.host; }

  connect(): void {
    if (this.ws) return;
    this._doConnect();
  }

  async request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || !this.connected) {
      throw new Error(`Remote gateway ${this.config.name} not connected`);
    }
    const id = randomUUID();
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timeout: ${method} on ${this.config.name}`));
      }, 15000);
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timeout });
      this.ws!.send(JSON.stringify({ type: 'req', id, method, params: params ?? {} }));
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close(1000);
    this.ws = null;
    this.connected = false;
  }

  private _doConnect(): void {
    try {
      this.ws = new WebSocket(this.config.url);
    } catch {
      this._scheduleReconnect();
      return;
    }

    this.ws.on('open', () => {
      console.log(`[RemoteGW:${this.config.name}] WebSocket open`);
    });

    this.ws.on('message', (data: WebSocket.RawData) => {
      this._onMessage(data.toString());
    });

    this.ws.on('error', (err: Error) => {
      console.error(`[RemoteGW:${this.config.name}] Error:`, err.message);
    });

    this.ws.on('close', () => {
      this.connected = false;
      for (const [id, p] of this.pending) {
        clearTimeout(p.timeout);
        p.reject(new Error('disconnected'));
        this.pending.delete(id);
      }
      this._scheduleReconnect();
    });
  }

  private _onMessage(raw: string): void {
    let f: Record<string, unknown>;
    try { f = JSON.parse(raw); } catch { return; }

    // Challenge → authenticate
    if (f.type === 'event' && (f as { event?: string }).event === 'connect.challenge') {
      const id = randomUUID();
      this.pending.set(id, {
        resolve: () => {
          console.log(`[RemoteGW:${this.config.name}] Authenticated ✓`);
          this.connected = true;
          this.backoff = 2000;
        },
        reject: (err) => console.error(`[RemoteGW:${this.config.name}] Auth failed:`, err.message),
        timeout: setTimeout(() => { this.pending.delete(id); }, 10000),
      });
      this.ws!.send(JSON.stringify({
        type: 'req', id, method: 'connect',
        params: {
          auth: { token: this.config.token },
          role: 'operator',
          scopes: ['operator.admin'],
          minProtocol: 3, maxProtocol: 3,
          client: { id: 'mc-remote', version: '0.1.0', platform: 'linux', mode: 'backend', displayName: `MC → ${this.config.name}` },
          caps: [],
        },
      }));
      return;
    }

    // Response
    if (f.type === 'res') {
      const res = f as { id: string; ok: boolean; payload: unknown; error?: { message: string } };
      const p = this.pending.get(res.id);
      if (!p) return;
      clearTimeout(p.timeout);
      this.pending.delete(res.id);
      res.ok ? p.resolve(res.payload) : p.reject(new Error(res.error?.message ?? 'failed'));
    }
  }

  private _scheduleReconnect(): void {
    this.ws = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.backoff = Math.min(this.backoff * 1.5, 30000);
      this._doConnect();
    }, this.backoff);
  }
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const _global = global as Record<string, unknown>;

function getRegistry(): Map<string, RemoteGateway> {
  if (!_global.__remoteGateways) {
    _global.__remoteGateways = new Map<string, RemoteGateway>();
  }
  return _global.__remoteGateways as Map<string, RemoteGateway>;
}

/**
 * Parse REMOTE_GATEWAYS env var.
 * Format: "name|host|url|token,name2|host2|url2|token2"
 */
export function initRemoteGateways(): void {
  const raw = process.env.REMOTE_GATEWAYS;
  if (!raw) return;

  const registry = getRegistry();
  for (const entry of raw.split(',')) {
    const [name, host, url, token] = entry.trim().split('|');
    if (!name || !url || !token) continue;
    if (registry.has(name)) continue;
    const gw = new RemoteGateway({ name, host: host || name, url, token });
    registry.set(name, gw);
    gw.connect();
    console.log(`[RemoteGW] Registered: ${name} → ${url}`);
  }
}

export function getRemoteGateways(): RemoteGateway[] {
  return Array.from(getRegistry().values());
}

export function getRemoteGateway(name: string): RemoteGateway | undefined {
  return getRegistry().get(name);
}
