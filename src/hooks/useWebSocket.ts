"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { getWsUrl, CONFIG } from "@/lib/config";
import type { WSEvent, ClientCommand } from "@/lib/ws-events";

export type WSStatus = "connecting" | "connected" | "disconnected" | "reconnecting";

interface UseWebSocketReturn {
  status: WSStatus;
  send: (command: ClientCommand) => void;
  lastEvent: WSEvent | null;
}

export function useWebSocket(onEvent: (event: WSEvent) => void): UseWebSocketReturn {
  const [status, setStatus] = useState<WSStatus>("disconnected");
  const [lastEvent, setLastEvent] = useState<WSEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef<number>(CONFIG.WS_RECONNECT_DELAY);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  const mountedRef = useRef(true);
  const connectRef = useRef<() => void>(undefined);

  // Sync callback ref in an effect
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const scheduleReconnect = useCallback(() => {
    reconnectDelay.current = Math.min(
      reconnectDelay.current * 1.5,
      CONFIG.WS_MAX_RECONNECT_DELAY
    );
    reconnectTimer.current = setTimeout(() => {
      connectRef.current?.();
    }, reconnectDelay.current);
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    const url = getWsUrl();
    setStatus("connecting");

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setStatus("connected");
        reconnectDelay.current = CONFIG.WS_RECONNECT_DELAY;
        ws.send(JSON.stringify({
          type: "subscribe",
          payload: { channels: ["*"] },
        }));
      };

      ws.onmessage = (ev) => {
        if (!mountedRef.current) return;
        try {
          const event: WSEvent = JSON.parse(ev.data);
          setLastEvent(event);
          onEventRef.current(event);
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        wsRef.current = null;
        setStatus("reconnecting");
        scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      setStatus("disconnected");
      scheduleReconnect();
    }
  }, [scheduleReconnect]);

  // Keep connectRef in sync via effect
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- WS init requires setState
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  const send = useCallback((command: ClientCommand) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(command));
    }
  }, []);

  return { status, send, lastEvent };
}
