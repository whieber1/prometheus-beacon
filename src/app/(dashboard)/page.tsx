'use client';

import { FolderKanban, Bot, Activity, Zap, Brain, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useGatewayStore } from '@/lib/stores/gateway-store';

export default function HomePage() {
  const status = useGatewayStore(s => s.prometheusStatus);
  const toolCalls = useGatewayStore(s => s.toolCalls);
  const activityFeed = useGatewayStore(s => s.activityFeed);
  const sessions = useGatewayStore(s => s.sessions);
  const lcm = useGatewayStore(s => s.lcmState);
  const connectionState = useGatewayStore(s => s.connectionState);

  const sessionCount = Object.keys(sessions).length;
  const successRate = toolCalls.length > 0
    ? Math.round((toolCalls.filter(tc => tc.success === true).length / toolCalls.length) * 100)
    : 0;
  const tokenPct = lcm ? Math.round((lcm.total_tokens / lcm.limit) * 100) : 0;

  const STAT_CARDS = [
    {
      label: 'Tool Calls',
      value: String(toolCalls.length),
      icon: FolderKanban,
      color: '#58a6ff',
      href: '/projects',
      desc: successRate > 0 ? `${successRate}% success rate` : 'Waiting for events',
    },
    {
      label: 'Agent State',
      value: status?.state ?? (connectionState === 'connected' ? 'idle' : 'offline'),
      icon: Bot,
      color: status?.state === 'running' ? '#3fb950' : status?.state === 'thinking' ? '#d29922' : '#8b949e',
      href: '/agents',
      desc: status ? `${status.model} · ${status.provider}` : 'Not connected',
    },
    {
      label: 'Activity',
      value: String(activityFeed.length),
      icon: Activity,
      color: '#d29922',
      href: '/activity',
      desc: 'Live events',
    },
    {
      label: 'Context',
      value: lcm ? `${tokenPct}%` : '—',
      icon: Zap,
      color: tokenPct > 80 ? '#f85149' : tokenPct > 60 ? '#d29922' : '#bc8cff',
      href: '/metrics',
      desc: lcm ? `${lcm.total_tokens.toLocaleString()} / ${lcm.limit.toLocaleString()} tokens` : 'No LCM data',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: '#e6edf3' }}>
          Beacon
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#8b949e' }}>
          Prometheus Agent Harness — {connectionState === 'connected' ? 'connected' : connectionState}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STAT_CARDS.map(card => (
          <Link
            key={card.label}
            href={card.href}
            className="block rounded-lg border p-4 transition-colors hover:border-blue-500/40"
            style={{ background: '#161b22', borderColor: '#30363d' }}
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className="p-2 rounded-md"
                style={{ background: card.color + '20' }}
              >
                <card.icon size={16} style={{ color: card.color }} />
              </div>
              <span className="text-2xl font-semibold font-mono capitalize" style={{ color: '#e6edf3' }}>
                {card.value}
              </span>
            </div>
            <p className="text-sm font-medium" style={{ color: '#e6edf3' }}>{card.label}</p>
            <p className="text-xs mt-0.5" style={{ color: '#8b949e' }}>{card.desc}</p>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="rounded-lg border p-6" style={{ background: '#161b22', borderColor: '#30363d' }}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: '#e6edf3' }}>Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <Link
            href="/projects"
            className="flex items-center gap-3 p-3 rounded-md border transition-colors text-sm hover:bg-[#21262d] hover:text-[#e6edf3]"
            style={{ borderColor: '#30363d', color: '#8b949e' }}
          >
            <FolderKanban size={15} style={{ color: '#58a6ff' }} />
            Tool Call Feed
          </Link>
          <Link
            href="/agents"
            className="flex items-center gap-3 p-3 rounded-md border transition-colors text-sm hover:bg-[#21262d] hover:text-[#e6edf3]"
            style={{ borderColor: '#30363d', color: '#8b949e' }}
          >
            <Bot size={15} style={{ color: '#3fb950' }} />
            Agent Status
          </Link>
          <Link
            href="/tools"
            className="flex items-center gap-3 p-3 rounded-md border transition-colors text-sm hover:bg-[#21262d] hover:text-[#e6edf3]"
            style={{ borderColor: '#30363d', color: '#8b949e' }}
          >
            <Wrench size={15} style={{ color: '#d2a8ff' }} />
            Skills & Config
          </Link>
        </div>
      </div>
    </div>
  );
}
