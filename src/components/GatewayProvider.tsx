'use client';

import { useEffect, useRef } from 'react';
import { useGateway } from '@/lib/hooks/use-gateway';
import { useGatewayStore } from '@/lib/stores/gateway-store';
import { api } from '@/lib/trpc';

/**
 * Seeds the gateway store with initial data from REST endpoints.
 * WS events will keep the store updated in real-time after this.
 */
function useInitialData() {
  const seededSessions = useRef(false);
  const seededTelemetry = useRef(false);
  const seededStatus = useRef(false);

  // Fetch sessions from tRPC (which hits Python REST /api/sessions)
  const { data: sessionsData } = api.sessions.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: 1,
  });

  useEffect(() => {
    if (sessionsData?.sessions?.length && !seededSessions.current) {
      seededSessions.current = true;
      const store = useGatewayStore.getState();
      // Only seed if store is empty (WS hasn't populated yet)
      if (Object.keys(store.sessions).length === 0) {
        store.setSessions(
          sessionsData.sessions.map((s: { key: string; kind?: string; label?: string; updatedAt?: number }) => ({
            key: s.key,
            kind: (s.kind ?? 'prometheus') as 'prometheus',
            label: s.label ?? s.key,
            updatedAt: s.updatedAt,
          }))
        );
      }
    }
  }, [sessionsData]);

  // Fetch telemetry for tool calls page
  const { data: telemetryData } = api.metrics.toolCallHistory.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: 1,
  });

  useEffect(() => {
    if (telemetryData?.calls?.length && !seededTelemetry.current) {
      seededTelemetry.current = true;
      const store = useGatewayStore.getState();
      if (store.toolCalls.length === 0) {
        // Seed tool calls from historical data (newest first, already sorted by tRPC)
        const historicalCalls = telemetryData.calls.map((tc: {
          call_id: string;
          tool_name: string;
          success?: boolean;
          error?: string;
          latency_ms?: number;
          started_at: number;
        }) => ({
          call_id: tc.call_id,
          tool_name: tc.tool_name,
          inputs: {} as Record<string, unknown>,
          success: tc.success,
          error: tc.error,
          latency_ms: tc.latency_ms,
          started_at: tc.started_at,
          finished_at: tc.started_at + (tc.latency_ms ? tc.latency_ms / 1000 : 0),
        }));
        // Use set directly to avoid the slice(0,200) in store action
        useGatewayStore.setState({ toolCalls: historicalCalls.slice(0, 200) });
      }
    }
  }, [telemetryData]);

  // Fetch agent status from REST /api/status
  const { data: statusData } = api.metrics.agentStatus.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: 1,
  });

  useEffect(() => {
    if (statusData && !seededStatus.current) {
      seededStatus.current = true;
      const store = useGatewayStore.getState();
      if (!store.prometheusStatus) {
        store.setPrometheusStatus({
          state: (statusData.state as 'idle' | 'thinking' | 'running' | 'dreaming' | 'errored') || 'idle',
          model: statusData.model || 'unknown',
          provider: statusData.provider || 'unknown',
          profile: statusData.profile || 'full',
          uptime_seconds: statusData.uptime_seconds || 0,
        });
      }
    }
  }, [statusData]);
}

/**
 * Mounts the gateway WebSocket connection once at the app root.
 * Also seeds initial data from REST endpoints.
 * Must be rendered inside a client component tree (under TRPCProvider).
 */
export function GatewayProvider({ children }: { children: React.ReactNode }) {
  useGateway();
  useInitialData();
  return <>{children}</>;
}
