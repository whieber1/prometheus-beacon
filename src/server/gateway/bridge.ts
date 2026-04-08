import WebSocket from 'ws';
import { randomUUID } from 'crypto';
import type {
  EventFrame,
  GatewayConnectionState,
  HelloOk,
  Session,
} from './types';

// ─── Types ────────────────────────────────────────────────────────────────────

type EventHandler = (event: EventFrame) => void;
type StateChangeHandler = (state: GatewayConnectionState) => void;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

interface GatewayBridgeOptions {
  url: string;
  token: string;
  onEvent?: EventHandler;
  onStateChange?: StateChangeHandler;
}

// ─── GatewayBridge singleton ──────────────────────────────────────────────────

export class GatewayBridge {
  private static instance: GatewayBridge | null = null;

  private ws: WebSocket | null = null;
  private connectionState: GatewayConnectionState = 'idle';
  private pendingRequests = new Map<string, PendingRequest>();
  private eventHandlers = new Set<EventHandler>();
  private stateHandlers = new Set<StateChangeHandler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = 1000;
  private readonly maxBackoffMs = 30000;
  private reconnectAttempt = 0;
  private shouldReconnect = true;

  // Cached data
  private cachedSessions: Session[] = [];
  private lastNonce: string | null = null;

  readonly url: string;
  readonly token: string;

  private constructor(options: GatewayBridgeOptions) {
    this.url = options.url;
    this.token = options.token;
    if (options.onEvent) this.eventHandlers.add(options.onEvent);
    if (options.onStateChange) this.stateHandlers.add(options.onStateChange);
  }

  static getInstance(options?: GatewayBridgeOptions): GatewayBridge {
    if (!GatewayBridge.instance) {
      if (!options) throw new Error('GatewayBridge not initialized — pass options on first call');
      GatewayBridge.instance = new GatewayBridge(options);
    }
    return GatewayBridge.instance;
  }

  static reset(): void {
    GatewayBridge.instance = null;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  subscribe(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  onStateChange(handler: StateChangeHandler): () => void {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  getState(): GatewayConnectionState {
    return this.connectionState;
  }

  getCachedSessions(): Session[] {
    return this.cachedSessions;
  }

  async request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Gateway not connected (state: ${this.connectionState})`);
    }

    const id = randomUUID();
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Gateway request timed out: ${method}`));
      }, 30000);

      this.pendingRequests.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timeoutId,
      });

      const frame = JSON.stringify({ type: 'req', id, method, params: params ?? {} });
      this.ws!.send(frame);
    });
  }

  connect(): void {
    if (this.connectionState === 'connecting' || this.connectionState === 'connected') return;
    this.shouldReconnect = true;
    this._connect();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this._clearReconnectTimer();
    this.ws?.close(1000, 'graceful shutdown');
    this.ws = null;
    this._setState('idle');
  }

  // ─── Internal connection logic ───────────────────────────────────────────────

  private _connect(): void {
    this._setState(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');
    console.log(`[GatewayBridge] Connecting to ${this.url} (attempt ${this.reconnectAttempt + 1})`);

    try {
      this.ws = new WebSocket(this.url);
    } catch (err) {
      console.error('[GatewayBridge] Failed to create WebSocket:', err);
      this._scheduleReconnect();
      return;
    }

    this.ws.on('open', () => {
      console.log('[GatewayBridge] WebSocket open, waiting for challenge...');
    });

    this.ws.on('message', (data: WebSocket.RawData) => {
      this._handleMessage(data.toString());
    });

    this.ws.on('error', (err: Error) => {
      console.error('[GatewayBridge] WebSocket error:', err.message);
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      console.log(`[GatewayBridge] Disconnected: ${code} ${reason.toString()}`);
      this._rejectAllPending(new Error(`Gateway disconnected: ${code}`));
      if (this.shouldReconnect) {
        this._scheduleReconnect();
      } else {
        this._setState('idle');
      }
    });
  }

  private _handleMessage(raw: string): void {
    let frame: unknown;
    try {
      frame = JSON.parse(raw);
    } catch {
      console.warn('[GatewayBridge] Invalid JSON from gateway:', raw.slice(0, 100));
      return;
    }

    if (typeof frame !== 'object' || frame === null) return;
    const f = frame as Record<string, unknown>;

    if (f.type === 'event') {
      const event = f as EventFrame;

      // Handle challenge → send connect request
      if (event.event === 'connect.challenge') {
        const payload = event.payload as { nonce: string; ts: number } | undefined;
        this.lastNonce = payload?.nonce ?? null;
        this._sendConnect();
        return;
      }

      // Broadcast to subscribers
      this.eventHandlers.forEach(h => {
        try { h(event); } catch (err) {
          console.error('[GatewayBridge] Event handler error:', err);
        }
      });

      // Update cached sessions on sessions.list events
      if (event.event === 'sessions.updated' || event.event === 'sessions.list') {
        const payload = event.payload as { sessions?: Session[] } | undefined;
        if (Array.isArray(payload?.sessions)) {
          this.cachedSessions = payload.sessions;
        }
      }

      return;
    }

    if (f.type === 'res') {
      const res = f as { id: string; ok: boolean; payload: unknown; error?: { message: string } };
      const pending = this.pendingRequests.get(res.id);
      if (!pending) return;

      clearTimeout(pending.timeoutId);
      this.pendingRequests.delete(res.id);

      if (res.ok) {
        pending.resolve(res.payload);
      } else {
        pending.reject(new Error(res.error?.message ?? 'Gateway request failed'));
      }
    }
  }

  private async _sendConnect(): Promise<void> {
    const connectId = randomUUID();

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(connectId);
        reject(new Error('Connect timeout'));
        this._scheduleReconnect();
      }, 10000);

      this.pendingRequests.set(connectId, {
        resolve: (payload: unknown) => {
          const hello = payload as HelloOk;
          console.log(`[GatewayBridge] Connected to ${hello?.server?.host ?? 'gateway'} (protocol ${hello?.protocol})`);
          this.backoffMs = 1000;
          this.reconnectAttempt = 0;
          this._setState('connected');

          // Fetch initial sessions
          this.request<{ sessions: Session[] }>('sessions.list', {})
            .then(res => { this.cachedSessions = res.sessions ?? []; })
            .catch(err => console.warn('[GatewayBridge] sessions.list failed:', err.message));

          resolve();
        },
        reject: (err: Error) => {
          console.error('[GatewayBridge] Connect failed:', err.message);
          this._scheduleReconnect();
          reject(err);
        },
        timeoutId,
      });

      const connectFrame = JSON.stringify({
        type: 'req',
        id: connectId,
        method: 'connect',
        params: {
          auth: { token: this.token },
          role: 'operator',
          scopes: ['operator.admin'],
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: 'gateway-client',
            version: '0.1.0',
            platform: process.platform,
            mode: 'backend',
            displayName: 'Beacon',
          },
          caps: [],
        },
      });

      this.ws!.send(connectFrame);
    });
  }

  private _scheduleReconnect(): void {
    if (!this.shouldReconnect) return;
    this._clearReconnectTimer();

    // Exponential backoff with jitter
    const jitter = Math.random() * 0.3 * this.backoffMs;
    const delay = Math.min(this.backoffMs + jitter, this.maxBackoffMs);
    this.reconnectAttempt++;

    console.log(`[GatewayBridge] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempt})`);
    this._setState('reconnecting');

    this.reconnectTimer = setTimeout(() => {
      this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs);
      this._connect();
    }, delay);
  }

  private _clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private _rejectAllPending(err: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeoutId);
      pending.reject(err);
      this.pendingRequests.delete(id);
    }
  }

  private _setState(state: GatewayConnectionState): void {
    if (this.connectionState === state) return;
    this.connectionState = state;
    this.stateHandlers.forEach(h => {
      try { h(state); } catch {}
    });
  }
}

// ─── Convenience helpers ─────────────────────────────────────────────────────
// Use global to survive Next.js module hot-reloads and cross-context sharing

const _global = global as Record<string, unknown>;

export function getGatewayBridge(): GatewayBridge {
  if (!_global.__gatewayBridge) {
    const url = process.env.PROMETHEUS_GATEWAY_URL ?? 'ws://127.0.0.1:18789';
    const token = process.env.PROMETHEUS_GATEWAY_TOKEN ?? '';
    const bridge = GatewayBridge.getInstance({ url, token });
    _global.__gatewayBridge = bridge;
  }
  return _global.__gatewayBridge as GatewayBridge;
}

export function initGatewayBridge(): GatewayBridge {
  const bridge = getGatewayBridge();
  bridge.connect();
  return bridge;
}
