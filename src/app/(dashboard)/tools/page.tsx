'use client';

import { useState, useEffect } from 'react';
import {
  Terminal, Globe, Monitor, Bell, Brain, Camera,
  Clock, MessageSquare, Search, Image, Volume2,
  FileText, Cpu, Wrench, Zap, BookOpen, Code2,
  FolderOpen, RefreshCw, Activity, ChevronRight
} from 'lucide-react';
import { useGatewayStore } from '@/lib/stores/gateway-store';

interface Tool {
  name: string;
  description: string;
  icon: React.ElementType;
  category: string;
  tags?: string[];
}

interface Skill {
  name: string;
  description: string;
  location: string;
}

const TOOL_CATEGORIES = [
  {
    id: 'filesystem',
    label: 'File System',
    color: '#3fb950',
    tools: [
      { name: 'Read', description: 'Read file contents — text files and images (jpg, png, gif, webp). Supports offset/limit for large files.', icon: FileText, tags: ['files', 'read'] },
      { name: 'Write', description: 'Write content to a file. Creates parent directories automatically.', icon: FileText, tags: ['files', 'write'] },
      { name: 'Edit', description: 'Make precise surgical edits to files by replacing exact text strings.', icon: Code2, tags: ['files', 'edit'] },
    ],
  },
  {
    id: 'shell',
    label: 'Shell',
    color: '#e3b341',
    tools: [
      { name: 'exec', description: 'Run shell commands. Supports background continuation, PTY mode for interactive CLIs, and elevated permissions.', icon: Terminal, tags: ['shell', 'run'] },
      { name: 'process', description: 'Manage running exec sessions — list, poll, log, write, send-keys, kill background processes.', icon: RefreshCw, tags: ['shell', 'process'] },
    ],
  },
  {
    id: 'web',
    label: 'Web',
    color: '#58a6ff',
    tools: [
      { name: 'web_search', description: 'Search the web via Brave Search API. Supports region/language filters. Returns titles, URLs, snippets.', icon: Search, tags: ['web', 'search'] },
      { name: 'web_fetch', description: 'Fetch and extract readable content from a URL. Converts HTML → markdown or text. Max 50KB.', icon: Globe, tags: ['web', 'fetch'] },
    ],
  },
  {
    id: 'browser',
    label: 'Browser',
    color: '#d2a8ff',
    tools: [
      { name: 'browser', description: 'Control the browser — open, navigate, snapshot, screenshot, click, type, act. Supports Chrome extension relay.', icon: Monitor, tags: ['browser', 'automation'] },
      { name: 'canvas', description: 'Control node canvases — present, hide, navigate, eval, snapshot, A2UI push.', icon: Monitor, tags: ['canvas', 'ui'] },
    ],
  },
  {
    id: 'communication',
    label: 'Messaging & Notifications',
    color: '#f78166',
    tools: [
      { name: 'message', description: 'Send, delete, and manage messages via channel plugins (Telegram, Discord, etc). Supports polls, reactions, threads.', icon: MessageSquare, tags: ['messaging', 'send'] },
      { name: 'nodes', description: 'Discover and control paired nodes — status, notify, camera, screen recording, location, run commands.', icon: Bell, tags: ['nodes', 'notify'] },
      { name: 'tts', description: 'Convert text to speech and return a media path. Use when audio/TTS is needed.', icon: Volume2, tags: ['audio', 'tts'] },
    ],
  },
  {
    id: 'memory',
    label: 'Memory',
    color: '#ffa657',
    tools: [
      { name: 'memory_search', description: 'Semantically search MEMORY.md and memory/*.md files. Mandatory recall step before answering questions about prior work.', icon: Brain, tags: ['memory', 'search'] },
      { name: 'memory_get', description: 'Safe snippet read from MEMORY.md or memory/*.md with optional from/lines parameters.', icon: BookOpen, tags: ['memory', 'read'] },
    ],
  },
  {
    id: 'sessions',
    label: 'Sessions & Agents',
    color: '#79c0ff',
    tools: [
      { name: 'agents_list', description: 'List agent IDs available for sessions_spawn based on allowlists.', icon: Cpu, tags: ['agents', 'list'] },
      { name: 'sessions_list', description: 'List sessions with optional filters and last messages.', icon: Activity, tags: ['sessions', 'list'] },
      { name: 'sessions_history', description: 'Fetch message history for a session.', icon: Clock, tags: ['sessions', 'history'] },
      { name: 'sessions_send', description: 'Send a message into another session — by sessionKey or label.', icon: MessageSquare, tags: ['sessions', 'send'] },
      { name: 'sessions_spawn', description: 'Spawn a background sub-agent run in an isolated session and announce the result back.', icon: Zap, tags: ['agents', 'spawn'] },
      { name: 'session_status', description: 'Show session status card — usage, time, cost. Supports optional per-session model override.', icon: Activity, tags: ['sessions', 'status'] },
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    color: '#56d364',
    tools: [
      { name: 'gateway', description: 'Restart, apply config, or update the Prometheus gateway in-place (SIGUSR1). Supports safe partial config patches.', icon: Wrench, tags: ['gateway', 'config'] },
      { name: 'cron', description: 'Manage Gateway cron jobs — add, update, remove, run, and send wake events. Supports at/every/cron schedules.', icon: Clock, tags: ['cron', 'schedule'] },
      { name: 'image', description: 'Analyze an image with a vision model. Use only when image not already provided in the message.', icon: Image, tags: ['vision', 'image'] },
    ],
  },
];

const INSTALLED_SKILLS: Skill[] = [
  { name: 'skillhub', description: 'Search, install, update, and publish agent skills.', location: '/usr/lib/node_modules/prometheus/skills/skillhub' },
  { name: 'coding-agent', description: 'Run Codex CLI, Claude Code, OpenCode, or Pi Coding Agent via background process.', location: '/usr/lib/node_modules/prometheus/skills/coding-agent' },
  { name: 'github', description: 'Interact with GitHub using the gh CLI — issues, PRs, CI runs, and advanced queries.', location: '/usr/lib/node_modules/prometheus/skills/github' },
  { name: 'healthcheck', description: 'Host security hardening and risk-tolerance configuration for Prometheus deployments.', location: '/usr/lib/node_modules/prometheus/skills/healthcheck' },
  { name: 'skill-creator', description: 'Create or update AgentSkills — design, structure, and package skills with scripts and assets.', location: '/usr/lib/node_modules/prometheus/skills/skill-creator' },
  { name: 'tmux', description: 'Remote-control tmux sessions for interactive CLIs by sending keystrokes and scraping pane output.', location: '/usr/lib/node_modules/prometheus/skills/tmux' },
  { name: 'weather', description: 'Get current weather and forecasts (no API key required).', location: '/usr/lib/node_modules/prometheus/skills/weather' },
  { name: 'sd-zone-scanner', description: 'Automated supply & demand zone scanner for TradingView. Runs on a scheduled basis.', location: '<WORKSPACE>/skills/sd-zone-scanner' },
  { name: 'yt-transcript-downloader', description: 'Download transcripts and captions from YouTube videos.', location: '<WORKSPACE>/skills/yt-transcript-downloader' },
];

function ToolCard({ tool, color }: { tool: { name: string; description: string; icon: React.ElementType; tags?: string[] }; color: string }) {
  const Icon = tool.icon;
  return (
    <div
      className="p-4 rounded-lg border transition-all"
      style={{ background: '#161b22', borderColor: '#30363d' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = color; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#30363d'; }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: `${color}18` }}
        >
          <Icon size={15} style={{ color }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold mb-1" style={{ color: '#e6edf3', fontFamily: 'var(--font-mono)' }}>
            {tool.name}
          </p>
          <p className="text-xs leading-relaxed" style={{ color: '#8b949e' }}>
            {tool.description}
          </p>
          {tool.tags && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tool.tags.map(tag => (
                <span
                  key={tag}
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{ background: '#0d1117', color: '#8b949e', border: '1px solid #30363d' }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SkillCard({ skill }: { skill: Skill }) {
  const isWorkspace = skill.location.includes('.prometheus/workspace') || skill.location.includes('<WORKSPACE>');
  return (
    <div
      className="p-4 rounded-lg border flex items-center gap-3 transition-all"
      style={{ background: '#161b22', borderColor: '#30363d' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#3fb950'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#30363d'; }}
    >
      <div
        className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: isWorkspace ? '#ffa65718' : '#3fb95018' }}
      >
        <FolderOpen size={14} style={{ color: isWorkspace ? '#ffa657' : '#3fb950' }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold" style={{ color: '#e6edf3', fontFamily: 'var(--font-mono)' }}>
            {skill.name}
          </p>
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              background: isWorkspace ? '#ffa65718' : '#3fb95018',
              color: isWorkspace ? '#ffa657' : '#3fb950',
              border: `1px solid ${isWorkspace ? '#ffa65730' : '#3fb95030'}`,
            }}
          >
            {isWorkspace ? 'workspace' : 'system'}
          </span>
        </div>
        <p className="text-xs mt-0.5 truncate" style={{ color: '#8b949e' }}>
          {skill.description}
        </p>
      </div>
      <ChevronRight size={14} style={{ color: '#30363d', flexShrink: 0 }} />
    </div>
  );
}

export default function ToolsPage() {
  const totalTools = TOOL_CATEGORIES.reduce((sum, cat) => sum + cat.tools.length, 0);
  const prometheusSkills = useGatewayStore(s => s.skills);
  const { setSkills } = useGatewayStore();

  // Fetch Prometheus skills on mount
  useEffect(() => {
    const base = typeof window !== 'undefined' ? `http://${window.location.hostname}:8005` : '';
    fetch(`${base}/api/skills`).then(r => r.ok ? r.json() : []).then(setSkills).catch(() => {});
  }, [setSkills]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="px-6 py-3 border-b flex items-center justify-between flex-shrink-0"
        style={{ background: '#161b22', borderColor: '#30363d' }}
      >
        <div>
          <h1 className="text-base font-semibold" style={{ color: '#e6edf3' }}>Tools & Skills</h1>
          <p className="text-xs" style={{ color: '#8b949e' }}>
            {totalTools} tools · {INSTALLED_SKILLS.length + prometheusSkills.length} skills
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">

        {/* Tool Categories */}
        {TOOL_CATEGORIES.map(category => (
          <section key={category.id}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full" style={{ background: category.color }} />
              <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8b949e' }}>
                {category.label}
              </h2>
              <span className="text-xs" style={{ color: '#484f58' }}>
                {category.tools.length}
              </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2">
              {category.tools.map(tool => (
                <ToolCard key={tool.name} tool={tool} color={category.color} />
              ))}
            </div>
          </section>
        ))}

        {/* Prometheus Skills */}
        {prometheusSkills.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full" style={{ background: '#39d2c0' }} />
              <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8b949e' }}>
                Prometheus Skills
              </h2>
              <span className="text-xs" style={{ color: '#484f58' }}>
                {prometheusSkills.length}
              </span>
            </div>
            <div className="space-y-2">
              {prometheusSkills.map(skill => (
                <div
                  key={skill.name}
                  className="p-4 rounded-lg border flex items-center gap-3 transition-all"
                  style={{ background: '#161b22', borderColor: '#30363d' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#39d2c0'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#30363d'; }}
                >
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: skill.source === 'builtin' ? '#3fb95018' : skill.source === 'auto' ? '#d2992218' : '#39d2c018' }}
                  >
                    <FolderOpen size={14} style={{ color: skill.source === 'builtin' ? '#3fb950' : skill.source === 'auto' ? '#d29922' : '#39d2c0' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold" style={{ color: '#e6edf3', fontFamily: 'var(--font-mono)' }}>
                        {skill.name}
                      </p>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          background: skill.source === 'builtin' ? '#3fb95018' : skill.source === 'auto' ? '#d2992218' : '#39d2c018',
                          color: skill.source === 'builtin' ? '#3fb950' : skill.source === 'auto' ? '#d29922' : '#39d2c0',
                          border: `1px solid ${skill.source === 'builtin' ? '#3fb95030' : skill.source === 'auto' ? '#d2992230' : '#39d2c030'}`,
                        }}
                      >
                        {skill.source}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5 truncate" style={{ color: '#8b949e' }}>
                      {skill.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Prometheus Skills */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full" style={{ background: '#d2a8ff' }} />
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8b949e' }}>
              Prometheus Skills
            </h2>
            <span className="text-xs" style={{ color: '#484f58' }}>
              {INSTALLED_SKILLS.length}
            </span>
          </div>
          <div className="space-y-2">
            {INSTALLED_SKILLS.map(skill => (
              <SkillCard key={skill.name} skill={skill} />
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
