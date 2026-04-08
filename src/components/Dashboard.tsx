"use client";

import { useState } from "react";

interface DashboardProps {
  chat: React.ReactNode;
  agentStatus: React.ReactNode;
  toolFeed: React.ReactNode;
  contextInspector: React.ReactNode;
  configPanel: React.ReactNode;
  header: React.ReactNode;
}

const TABS = [
  { id: "chat", label: "Chat" },
  { id: "status", label: "Status" },
  { id: "tools", label: "Tools" },
  { id: "context", label: "Context" },
  { id: "config", label: "Config" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function Dashboard({ chat, agentStatus, toolFeed, contextInspector, configPanel, header }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>("chat");

  const panelMap: Record<TabId, React.ReactNode> = {
    chat,
    status: agentStatus,
    tools: toolFeed,
    context: contextInspector,
    config: configPanel,
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-bg-secondary shrink-0">
        {header}
      </header>

      {/* Desktop: 3-column grid */}
      <div className="hidden lg:grid lg:grid-cols-[1fr_340px_340px] flex-1 min-h-0 gap-px bg-border">
        <div className="flex flex-col min-h-0 bg-bg-primary">
          {chat}
        </div>
        <div className="flex flex-col min-h-0 gap-px bg-border">
          <div className="flex-[2] min-h-0 bg-bg-primary">{agentStatus}</div>
          <div className="flex-[3] min-h-0 bg-bg-primary">{toolFeed}</div>
        </div>
        <div className="flex flex-col min-h-0 gap-px bg-border">
          <div className="flex-[2] min-h-0 bg-bg-primary">{contextInspector}</div>
          <div className="flex-[3] min-h-0 bg-bg-primary">{configPanel}</div>
        </div>
      </div>

      {/* Tablet: 2-column */}
      <div className="hidden md:grid md:grid-cols-[1fr_360px] lg:hidden flex-1 min-h-0 gap-px bg-border">
        <div className="flex flex-col min-h-0 bg-bg-primary">
          {chat}
        </div>
        <div className="flex flex-col min-h-0 gap-px bg-border">
          <div className="flex-1 min-h-0 bg-bg-primary">{agentStatus}</div>
          <div className="flex-1 min-h-0 bg-bg-primary">{toolFeed}</div>
          <div className="flex-1 min-h-0 bg-bg-primary">{contextInspector}</div>
          <div className="flex-1 min-h-0 bg-bg-primary">{configPanel}</div>
        </div>
      </div>

      {/* Mobile: Tabbed single panel */}
      <div className="flex flex-col md:hidden flex-1 min-h-0">
        <div className="flex-1 min-h-0 overflow-auto">
          {panelMap[activeTab]}
        </div>
        <nav className="flex border-t border-border bg-bg-secondary shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
                activeTab === tab.id
                  ? "text-accent border-t-2 border-accent bg-bg-panel"
                  : "text-text-muted"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
