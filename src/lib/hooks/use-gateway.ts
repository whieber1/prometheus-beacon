'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useGatewayStore } from '@/lib/stores/gateway-store';
import type { BrowserMessage, ClientMessage, PrometheusEvent } from '@/server/gateway/types';

// Prometheus WebSocket on port 8010 (direct, no relay server)
const WS_URL =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_WS_URL
        ? process.env.NEXT_PUBLIC_WS_URL
        : `ws://${window.location.hostname}:8010`)
    : null;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

export function useGateway() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(RECONNECT_BASE_MS);
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);

  const {
    setConnectionState,
    setWs,
    setSessions,
    handleGatewayEvent,
    handlePrometheusEvent,
    setAgents,
  } = useGatewayStore();

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const connect = useCallback(() => {
    if (!WS_URL || !mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    setWs(ws as unknown as Parameters<typeof setWs>[0]);
    setConnectionState('connecting');

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      backoffRef.current = RECONNECT_BASE_MS;
      attemptRef.current = 0;
      console.log('[useGateway] Connected to Prometheus WebSocket');
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      if (!mountedRef.current) return;
      let raw: Record<string, unknown>;
      try {
        raw = JSON.parse(event.data) as Record<string, unknown>;
      } catch {
        return;
      }

      // Prometheus event format: { type, timestamp, payload }
      if (raw.timestamp !== undefined && raw.payload !== undefined) {
        const promEvent: PrometheusEvent = {
          type: raw.type as string,
          timestamp: raw.timestamp as number,
          payload: raw.payload as Record<string, unknown>,
          source: raw.source as string | undefined,
        };

        // Handle connection
        if (promEvent.type === 'connected') {
          setConnectionState('connected');
          useGatewayStore.getState().addActivity({
            id: `prom_connected-${Date.now()}`,
            eventName: 'connected',
            payload: promEvent.payload,
            receivedAt: Date.now(),
            category: 'system',
            summary: 'Prometheus connected',
          });
          return;
        }

        handlePrometheusEvent(promEvent);
        return;
      }

      // Fall back to legacy BrowserMessage format
      const msg = raw as unknown as BrowserMessage;
      switch (msg.type) {
        case 'gateway_connected':
          setConnectionState('connected');
          useGatewayStore.getState().addActivity({
            id: `gateway_connected-${Date.now()}`,
            eventName: 'gateway_connected',
            payload: null,
            receivedAt: Date.now(),
            category: 'system',
            summary: 'Gateway connected',
          });
          break;
        case 'gateway_disconnected':
          setConnectionState('failed');
          break;
        case 'gateway_reconnecting':
          setConnectionState('reconnecting');
          break;
        case 'sessions_snapshot':
          setSessions(msg.sessions);
          break;
        case 'gateway_event':
          handleGatewayEvent(msg.event);
          break;
        case 'approval_request':
          useGatewayStore.getState().addApproval(msg.approval);
          break;
        case 'approval_resolved':
          useGatewayStore.getState().resolveApproval(msg.approvalId);
          break;
        default:
          break;
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      setWs(null);
      if (!mountedRef.current) return;
      scheduleReconnect();
    };

    ws.onerror = (err) => {
      console.error('[useGateway] WebSocket error:', err);
    };
  }, [setConnectionState, setWs, setSessions, handleGatewayEvent, handlePrometheusEvent, setAgents]);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);

    const jitter = Math.random() * 0.3 * backoffRef.current;
    const delay = Math.min(backoffRef.current + jitter, RECONNECT_MAX_MS);
    attemptRef.current++;
    setConnectionState('reconnecting');

    console.log(`[useGateway] Reconnecting in ${Math.round(delay)}ms (attempt ${attemptRef.current})`);

    reconnectTimerRef.current = setTimeout(() => {
      backoffRef.current = Math.min(backoffRef.current * 2, RECONNECT_MAX_MS);
      connect();
    }, delay);
  }, [connect, setConnectionState]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close(1000, 'component unmount');
      wsRef.current = null;
    };
  }, [connect]);

  return { send };
}
