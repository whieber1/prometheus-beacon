'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FolderKanban,
  Bot,
  BarChart3,
  Wrench,
  Files,
  Activity,
  Circle,
  Terminal,
  Wifi,
  WifiOff,
  Server,
} from 'lucide-react';
import { useGatewayStore } from '@/lib/stores/gateway-store';

const NAV_ITEMS = [
  { label: 'Tool Calls', href: '/projects', icon: FolderKanban },
  { label: 'Agent Status', href: '/agents', icon: Bot },
  { label: 'Sessions', href: '/sessions', icon: Terminal },
  { label: 'Metrics', href: '/metrics', icon: BarChart3 },
  { label: 'Skills', href: '/tools', icon: Wrench },
  { label: 'Files', href: '/files', icon: Files },
  { label: 'Activity', href: '/activity', icon: Activity },
  { label: 'System Control', href: 'http://localhost:8088', icon: Server, external: true },
];

function GatewayStatusDot() {
  const state = useGatewayStore(s => s.connectionState);
  const color =
    state === 'connected' ? '#3fb950' :
    state === 'connecting' || state === 'reconnecting' ? '#d29922' :
    '#f85149';

  const Icon = state === 'connected' ? Wifi : WifiOff;

  return (
    <div className="flex items-center gap-1.5" title={`Gateway: ${state}`}>
      <Icon size={11} style={{ color }} />
      <span className="text-xs" style={{ color }}>
        {state}
      </span>
    </div>
  );
}

function SessionList() {
  const sessions = useGatewayStore(s => s.sessions);
  const status = useGatewayStore(s => s.prometheusStatus);
  const sessionList = Object.values(sessions);

  if (sessionList.length === 0) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 px-1 py-1">
          <Circle size={8} fill="#8b949e" stroke="none" />
          <span className="text-xs" style={{ color: '#8b949e' }}>No sessions</span>
        </div>
        {status && (
          <div className="flex items-center gap-2 px-1 py-1">
            <Circle size={8} fill={status.state === 'idle' ? '#8b949e' : '#3fb950'} stroke="none" />
            <span className="text-xs" style={{ color: '#8b949e' }}>{status.model}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {sessionList.slice(0, 8).map(session => {
        const label = session.label || session.key.slice(0, 12);
        return (
          <Link
            key={session.key}
            href="/sessions"
            className="flex items-center gap-2 px-1 py-1 rounded transition-colors hover:bg-[#21262d]"
          >
            <Circle size={8} fill="#39d2c0" stroke="none" />
            <span className="text-xs flex-1 truncate" style={{ color: '#e6edf3' }}>
              {label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col shrink-0 border-r"
      style={{
        width: '220px',
        background: '#161b22',
        borderColor: '#30363d',
      }}
    >
      {/* Logo */}
      <div className="px-3 py-3 border-b" style={{ borderColor: '#30363d' }}>
        <Link href="/" className="block">
          <img src="/logo-transparent.png" alt="Beacon" style={{ width: '100%' }} />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ label, href, icon: Icon, external }) => {
          const active = !external && (pathname === href || pathname.startsWith(href + '/'));
          return (
            <Link
              key={href}
              href={href}
              target={external ? '_blank' : undefined}
              rel={external ? 'noopener noreferrer' : undefined}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors"
              style={{
                background: active ? '#21262d' : 'transparent',
                color: active ? '#e6edf3' : '#8b949e',
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = '#21262d';
                  (e.currentTarget as HTMLElement).style.color = '#e6edf3';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = '#8b949e';
                }
              }}
            >
              <Icon size={15} strokeWidth={1.5} />
              <span className="flex-1">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Connected agents */}
      <div className="px-3 py-3 border-t" style={{ borderColor: '#30363d' }}>
        <p className="text-xs uppercase tracking-wider mb-2 px-1" style={{ color: '#8b949e' }}>
          Sessions
        </p>
        <SessionList />
      </div>

      {/* Gateway status */}
      <div className="px-4 py-2.5 border-t" style={{ borderColor: '#30363d' }}>
        <GatewayStatusDot />
      </div>
    </aside>
  );
}
