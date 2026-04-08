'use client';

import { create } from 'zustand';

interface UIStore {
  activeChatSession: string | null;
  selectedAgentId: string | null;
  sidebarOpen: boolean;

  openChat: (sessionKey: string) => void;
  closeChat: () => void;
  selectAgent: (agentId: string | null) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activeChatSession: null,
  selectedAgentId: null,
  sidebarOpen: true,

  openChat: (sessionKey) => set({ activeChatSession: sessionKey }),
  closeChat: () => set({ activeChatSession: null }),
  selectAgent: (agentId) => set({ selectedAgentId: agentId }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
