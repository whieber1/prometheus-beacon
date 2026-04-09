'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { FolderKanban, Zap } from 'lucide-react';
import KanbanBoard from '@/components/KanbanBoard';
import ToolCallFeed from '@/components/ToolCallFeed';

type View = 'board' | 'feed';

const TABS: { id: View; label: string; icon: typeof FolderKanban }[] = [
  { id: 'board', label: 'Board', icon: FolderKanban },
  { id: 'feed', label: 'Tool Feed', icon: Zap },
];

export default function ProjectsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialView = (searchParams.get('view') as View) || 'board';
  const [view, setView] = useState<View>(initialView);

  const switchView = (v: View) => {
    setView(v);
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', v);
    router.replace(`/projects?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div
        className="px-6 py-2 border-b flex items-center gap-1 flex-shrink-0"
        style={{ background: '#161b22', borderColor: '#30363d' }}
      >
        {TABS.map(tab => {
          const active = view === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => switchView(tab.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
              style={{
                background: active ? '#21262d' : 'transparent',
                color: active ? '#e6edf3' : '#8b949e',
                border: active ? '1px solid #30363d' : '1px solid transparent',
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
              <Icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {view === 'board' ? (
          <div className="h-full p-6 overflow-auto">
            <KanbanBoard />
          </div>
        ) : (
          <ToolCallFeed />
        )}
      </div>
    </div>
  );
}
