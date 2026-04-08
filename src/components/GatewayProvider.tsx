'use client';

import { useEffect } from 'react';
import { useGateway } from '@/lib/hooks/use-gateway';

/**
 * Mounts the gateway WebSocket connection once at the app root.
 * Must be rendered inside a client component tree.
 */
export function GatewayProvider({ children }: { children: React.ReactNode }) {
  useGateway();
  return <>{children}</>;
}
