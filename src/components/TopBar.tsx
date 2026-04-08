'use client';

import { useState } from 'react';
import { Search, Wifi, WifiOff, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TopBar() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/login', { method: 'DELETE' });
    router.push('/login');
  }

  return (
    <header
      className="flex items-center gap-4 px-6 py-3 border-b shrink-0"
      style={{ background: '#161b22', borderColor: '#30363d', height: '52px' }}
    >
      {/* Search */}
      <div className="flex items-center gap-2 flex-1 max-w-sm">
        <Search size={14} style={{ color: '#8b949e' }} />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search stories, projects..."
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: '#e6edf3' }}
        />
      </div>

      {/* Status chips */}
      <div className="flex items-center gap-3 ml-auto">
        {/* WS connection */}
        <div
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
          style={{ background: '#21262d', color: '#3fb950', border: '1px solid rgba(63,185,80,0.3)' }}
          title="WebSocket connected"
        >
          <Wifi size={11} />
          <span>Connected</span>
        </div>

        {/* Token usage placeholder */}
        <div
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
          style={{ background: '#21262d', color: '#8b949e', border: '1px solid #30363d' }}
          title="Token usage"
        >
          <Zap size={11} />
          <span>—</span>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="text-xs px-2.5 py-1 rounded-md transition-colors"
          style={{ color: '#8b949e', border: '1px solid #30363d' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = '#f85149';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(248,81,73,0.4)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = '#8b949e';
            (e.currentTarget as HTMLElement).style.borderColor = '#30363d';
          }}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
