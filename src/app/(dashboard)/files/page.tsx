'use client';

import { useState } from 'react';
import {
  Folder,
  FolderOpen,
  FileText,
  File,
  ChevronRight,
  Home,
  RefreshCw,
  Copy,
  Check,
  ArrowLeft,
  FileCode,
  FileJson,
  Image,
  Link,
  HardDrive,
} from 'lucide-react';
import { api } from '@/lib/trpc';
import type { FileEntry } from '@/server/routers/files';

// ─── File icon ────────────────────────────────────────────────────────────────

function FileIcon({ entry }: { entry: FileEntry }) {
  if (entry.type === 'directory') return <Folder size={14} style={{ color: '#e3b341' }} />;
  if (entry.type === 'symlink') return <Link size={14} style={{ color: '#79c0ff' }} />;
  const ext = entry.ext;
  if (['.ts', '.tsx', '.js', '.jsx', '.py', '.swift', '.go', '.rs'].includes(ext))
    return <FileCode size={14} style={{ color: '#79c0ff' }} />;
  if (['.json', '.yaml', '.yml', '.toml'].includes(ext))
    return <FileJson size={14} style={{ color: '#3fb950' }} />;
  if (['.md', '.txt', '.log'].includes(ext))
    return <FileText size={14} style={{ color: '#8b949e' }} />;
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico'].includes(ext))
    return <Image size={14} style={{ color: '#d2a8ff' }} />;
  return <File size={14} style={{ color: '#6e7681' }} />;
}

// ─── Syntax-highlight lang detection ─────────────────────────────────────────

function langFromExt(ext: string): string {
  const map: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
    '.py': 'python', '.sh': 'bash', '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
    '.md': 'markdown', '.sql': 'sql', '.toml': 'toml', '.env': 'bash',
  };
  return map[ext] ?? 'text';
}

// ─── File preview panel ───────────────────────────────────────────────────────

function FilePreview({ filePath, onClose }: { filePath: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const { data, isLoading, error } = api.files.read.useQuery({ filePath });

  const handleCopy = () => {
    if (data?.content) {
      navigator.clipboard.writeText(data.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(filePath);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const fileName = filePath.split('/').pop() ?? filePath;
  const ext = '.' + (fileName.split('.').pop() ?? '');

  return (
    <div
      className="flex flex-col h-full border-l"
      style={{ borderColor: '#30363d', background: '#0d1117', minWidth: 0 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b flex-shrink-0"
        style={{ background: '#161b22', borderColor: '#30363d' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onClose} className="flex-shrink-0" title="Close preview">
            <ArrowLeft size={14} style={{ color: '#8b949e' }} />
          </button>
          <span className="text-xs font-mono truncate" style={{ color: '#e6edf3' }}>{fileName}</span>
          {data && <span className="text-xs flex-shrink-0" style={{ color: '#6e7681' }}>{data.sizeFormatted}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyPath}
            className="text-xs px-2 py-1 rounded transition-colors flex items-center gap-1"
            style={{ background: '#21262d', color: '#8b949e', border: '1px solid #30363d' }}
            title="Copy path"
          >
            <Copy size={10} /> Path
          </button>
          {data?.content && (
            <button
              onClick={handleCopy}
              className="text-xs px-2 py-1 rounded transition-colors flex items-center gap-1"
              style={{
                background: copied ? '#3fb95020' : '#21262d',
                color: copied ? '#3fb950' : '#8b949e',
                border: `1px solid ${copied ? '#3fb95040' : '#30363d'}`,
              }}
            >
              {copied ? <Check size={10} /> : <Copy size={10} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <RefreshCw size={16} className="animate-spin" style={{ color: '#8b949e' }} />
          </div>
        )}
        {error && (
          <div className="p-4">
            <p className="text-xs" style={{ color: '#f85149' }}>{error.message}</p>
          </div>
        )}
        {data && !data.content && (
          <div className="flex items-center justify-center h-32 px-6 text-center">
            <p className="text-xs" style={{ color: '#8b949e' }}>{data.message}</p>
          </div>
        )}
        {data?.content && (
          <pre
            className="p-4 text-xs overflow-auto h-full"
            style={{
              color: '#e6edf3',
              fontFamily: 'var(--font-mono)',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {data.content}
          </pre>
        )}
      </div>
    </div>
  );
}

// ─── File row ─────────────────────────────────────────────────────────────────

function FileRow({
  entry,
  onClick,
  selected,
}: {
  entry: FileEntry;
  onClick: () => void;
  selected: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyPath = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(entry.path);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const timeStr = new Date(entry.modifiedAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 cursor-pointer transition-colors group"
      style={{
        background: selected ? '#1f6feb20' : 'transparent',
        borderBottom: '1px solid #21262d',
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = '#161b22'; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      onClick={onClick}
    >
      <FileIcon entry={entry} />
      <span className="flex-1 text-xs truncate" style={{ color: '#e6edf3' }}>
        {entry.name}
        {entry.type === 'directory' && <span style={{ color: '#8b949e' }}>/</span>}
      </span>
      <span
        className="text-xs flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: '#8b949e' }}
        onClick={handleCopyPath}
        title="Copy path"
      >
        {copied ? <Check size={10} /> : <Copy size={10} />}
      </span>
      {entry.type === 'file' && (
        <span className="text-xs flex-shrink-0" style={{ color: '#6e7681', minWidth: 48, textAlign: 'right' }}>
          {entry.sizeFormatted}
        </span>
      )}
      <span className="text-xs flex-shrink-0 hidden sm:block" style={{ color: '#484f58', minWidth: 110, textAlign: 'right' }}>
        {timeStr}
      </span>
      {entry.type === 'directory' && (
        <ChevronRight size={12} style={{ color: '#6e7681', flexShrink: 0 }} />
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FilesPage() {
  const [currentPath, setCurrentPath] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = api.files.list.useQuery(
    { dir: currentPath },
    { refetchOnWindowFocus: false }
  );
  const { data: stats } = api.files.stats.useQuery(undefined, { refetchOnWindowFocus: false });

  const handleEntry = (entry: FileEntry) => {
    if (entry.type === 'directory') {
      setCurrentPath(entry.path);
      setSelectedFile(null);
    } else {
      setSelectedFile(selectedFile === entry.path ? null : entry.path);
    }
  };

  const navigateTo = (p: string) => {
    setCurrentPath(p);
    setSelectedFile(null);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div
        className="px-6 py-3 border-b flex items-center justify-between flex-shrink-0"
        style={{ background: '#161b22', borderColor: '#30363d' }}
      >
        <div>
          <h1 className="text-base font-semibold" style={{ color: '#e6edf3' }}>Files</h1>
          {stats && (
            <p className="text-xs" style={{ color: '#8b949e' }}>
              {stats.fileCount} files · {stats.dirCount} dirs · {stats.totalSizeFormatted}
            </p>
          )}
        </div>
        <button
          onClick={() => refetch()}
          className="p-1.5 rounded transition-colors"
          style={{ background: '#21262d', border: '1px solid #30363d' }}
          title="Refresh"
        >
          <RefreshCw size={12} style={{ color: '#8b949e' }} />
        </button>
      </div>

      {/* Breadcrumb */}
      <div
        className="px-6 py-2 border-b flex items-center gap-1 overflow-x-auto flex-shrink-0"
        style={{ background: '#0d1117', borderColor: '#21262d' }}
      >
        {data?.breadcrumb.map((crumb, i) => (
          <span key={crumb.path} className="flex items-center gap-1 flex-shrink-0">
            {i > 0 && <ChevronRight size={11} style={{ color: '#484f58' }} />}
            <button
              onClick={() => navigateTo(crumb.path)}
              className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded transition-colors"
              style={{
                color: i === (data.breadcrumb.length - 1) ? '#e6edf3' : '#58a6ff',
                background: i === (data.breadcrumb.length - 1) ? '#21262d' : 'transparent',
              }}
            >
              {i === 0 && <Home size={10} />}
              {crumb.name}
            </button>
          </span>
        ))}
      </div>

      {/* Main content split */}
      <div className="flex flex-1 overflow-hidden">

        {/* File list */}
        <div className={`flex flex-col overflow-hidden ${selectedFile ? 'w-1/2 flex-shrink-0' : 'flex-1'}`}
          style={{ borderRight: selectedFile ? '1px solid #30363d' : 'none' }}
        >
          {/* Column headers */}
          <div
            className="flex items-center px-4 py-1.5 border-b flex-shrink-0"
            style={{ background: '#161b22', borderColor: '#30363d' }}
          >
            <span className="flex-1 text-xs uppercase tracking-wide" style={{ color: '#6e7681' }}>Name</span>
            <span className="text-xs uppercase tracking-wide flex-shrink-0" style={{ color: '#6e7681', minWidth: 48, textAlign: 'right' }}>Size</span>
            <span className="text-xs uppercase tracking-wide flex-shrink-0 hidden sm:block" style={{ color: '#6e7681', minWidth: 110, textAlign: 'right' }}>Modified</span>
            <span style={{ width: 12 }} />
          </div>

          {/* Entries */}
          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center h-32">
                <RefreshCw size={16} className="animate-spin" style={{ color: '#8b949e' }} />
              </div>
            )}
            {error && (
              <div className="p-6 text-center">
                <p className="text-xs" style={{ color: '#f85149' }}>{error.message}</p>
              </div>
            )}
            {currentPath && !isLoading && (
              <div
                className="flex items-center gap-2 px-4 py-2 cursor-pointer transition-colors"
                style={{ borderBottom: '1px solid #21262d' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#161b22'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                onClick={() => {
                  const parts = currentPath.split('/').filter(Boolean);
                  parts.pop();
                  navigateTo(parts.join('/'));
                }}
              >
                <FolderOpen size={14} style={{ color: '#e3b341' }} />
                <span className="text-xs" style={{ color: '#8b949e' }}>.. (parent directory)</span>
              </div>
            )}
            {data?.entries.map(entry => (
              <FileRow
                key={entry.path}
                entry={entry}
                onClick={() => handleEntry(entry)}
                selected={selectedFile === entry.path}
              />
            ))}
            {!isLoading && data?.entries.length === 0 && (
              <div className="p-8 text-center">
                <Folder size={32} style={{ color: '#30363d' }} className="mx-auto mb-2" />
                <p className="text-xs" style={{ color: '#8b949e' }}>Empty directory</p>
              </div>
            )}
          </div>
        </div>

        {/* File preview */}
        {selectedFile && (
          <div className="flex-1 overflow-hidden">
            <FilePreview filePath={selectedFile} onClose={() => setSelectedFile(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
