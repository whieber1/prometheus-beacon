'use client';

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertCircle, Bot, Search } from 'lucide-react';
import { useState, useMemo } from 'react';
import { api } from '@/lib/trpc';
import { AgentCard } from './AgentCard';
import { useGatewayStore } from '@/lib/stores/gateway-store';

// ─── Error boundary ───────────────────────────────────────────────────────────

interface EBState { hasError: boolean; error?: Error }
class FleetErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false };
  static getDerivedStateFromError(error: Error): EBState { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('[AgentFleet] Error:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle size={32} style={{ color: '#f85149' }} className="mx-auto mb-3" />
            <p className="text-sm font-medium" style={{ color: '#f85149' }}>Agent fleet failed to load</p>
            <p className="text-xs mt-1" style={{ color: '#8b949e' }}>{this.state.error?.message}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Skeleton grid ────────────────────────────────────────────────────────────

function FleetSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map(i => (
        <div
          key={i}
          className="rounded-xl border p-4 animate-pulse"
          style={{ background: '#161b22', borderColor: '#30363d', height: '140px' }}
        />
      ))}
    </div>
  );
}

// ─── Agent fleet inner ────────────────────────────────────────────────────────

function AgentFleetInner() {
  const [search, setSearch] = useState('');

  const { data: agentsData, isLoading: agentsLoading, error: agentsError } =
    api.agents.list.useQuery(undefined, { refetchInterval: 30000 });

  const { data: sessionsData, isLoading: sessionsLoading } =
    api.agents.sessions.useQuery(undefined, { refetchInterval: 15000 });

  const pendingApprovals = useGatewayStore(state => state.pendingApprovals);

  // Group sessions by agent
  const sessionsByAgent = useMemo(() => {
    const sessions = sessionsData?.sessions ?? [];
    const byAgent: Record<string, typeof sessions> = {};
    for (const s of sessions) {
      // Extract agent ID from session key (e.g., "agent:main:main" → "main")
      const parts = s.key.split(':');
      const agentId = parts[1] ?? 'main';
      if (!byAgent[agentId]) byAgent[agentId] = [];
      byAgent[agentId].push(s);
    }
    return byAgent;
  }, [sessionsData]);

  const agents = agentsData?.agents ?? [];
  const filteredAgents = useMemo(
    () => agents.filter(a => a.id.toLowerCase().includes(search.toLowerCase())),
    [agents, search],
  );

  const isLoading = agentsLoading || sessionsLoading;

  if (agentsError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle size={24} style={{ color: '#f85149' }} className="mx-auto mb-2" />
          <p className="text-sm" style={{ color: '#f85149' }}>{agentsError.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + search */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#e6edf3' }}>Agent Fleet</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8b949e' }}>
            {agents.length} {agents.length === 1 ? 'agent' : 'agents'} configured
          </p>
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg border"
          style={{ background: '#21262d', borderColor: '#30363d' }}
        >
          <Search size={14} style={{ color: '#8b949e' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search agents…"
            className="bg-transparent text-sm outline-none"
            style={{ color: '#e6edf3', width: '180px' }}
          />
        </div>
      </div>

      {/* Fleet grid */}
      {isLoading ? (
        <FleetSkeleton />
      ) : filteredAgents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Bot size={40} style={{ color: '#30363d' }} className="mb-4" />
          <p className="text-sm font-medium" style={{ color: '#8b949e' }}>
            {search ? 'No agents match your search' : 'No agents configured'}
          </p>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-xs mt-2"
              style={{ color: '#58a6ff' }}
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgents.map(agent => (
            <AgentCard
              key={agent.id}
              agentId={agent.id}
              sessions={sessionsByAgent[agent.id] ?? []}
              pendingApprovals={
                pendingApprovals.filter(a => a.agentId === agent.id).length
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

export function AgentFleet() {
  return (
    <FleetErrorBoundary>
      <AgentFleetInner />
    </FleetErrorBoundary>
  );
}
