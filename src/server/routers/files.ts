import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT ?? path.join(os.homedir(), '.prometheus');
const MAX_FILE_SIZE = 1024 * 512; // 512KB read limit
const IMAGE_CACHE_DIR = path.join(os.homedir(), '.prometheus', 'cache', 'images');

function safePath(p: string): string {
  const resolved = path.resolve(WORKSPACE_ROOT, p.replace(/^\/+/, ''));
  if (!resolved.startsWith(WORKSPACE_ROOT)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Path outside workspace' });
  }
  return resolved;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FileEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(['file', 'directory', 'symlink']),
  size: z.number(),
  sizeFormatted: z.string(),
  modifiedAt: z.number(),
  ext: z.string(),
});
export type FileEntry = z.infer<typeof FileEntrySchema>;

export const filesRouter = router({
  list: protectedProcedure
    .input(z.object({ dir: z.string().default('') }))
    .query(async ({ input }) => {
      const dirPath = safePath(input.dir);

      if (!fs.existsSync(dirPath)) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Directory not found' });
      }

      const stat = fs.statSync(dirPath);
      if (!stat.isDirectory()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not a directory' });
      }

      const names = fs.readdirSync(dirPath);
      const entries: FileEntry[] = [];

      for (const name of names) {
        if (name.startsWith('.') && name !== '.gitignore') {
          // Show dotfiles that are meaningful
          const keep = ['.env', '.env.local', '.gitignore', '.prometheus'].some(d => name === d || name.startsWith('.prometheus'));
          if (!keep) continue;
        }

        const fullPath = path.join(dirPath, name);
        const relPath = path.relative(WORKSPACE_ROOT, fullPath);

        try {
          const s = fs.lstatSync(fullPath);
          const type: 'file' | 'directory' | 'symlink' = s.isSymbolicLink()
            ? 'symlink'
            : s.isDirectory()
            ? 'directory'
            : 'file';

          entries.push({
            name,
            path: relPath,
            type,
            size: s.size,
            sizeFormatted: formatSize(s.size),
            modifiedAt: s.mtimeMs,
            ext: type === 'file' ? path.extname(name).toLowerCase() : '',
          });
        } catch {
          // Skip unreadable entries
        }
      }

      // Sort: directories first, then files, both alphabetically
      entries.sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });

      // Build breadcrumb
      const parts = input.dir ? input.dir.split('/').filter(Boolean) : [];
      const breadcrumb = [
        { name: 'prometheus', path: '' },
        ...parts.map((p, i) => ({ name: p, path: parts.slice(0, i + 1).join('/') })),
      ];

      return { entries, breadcrumb, currentPath: input.dir, root: WORKSPACE_ROOT };
    }),

  read: protectedProcedure
    .input(z.object({ filePath: z.string() }))
    .query(async ({ input }) => {
      const fullPath = safePath(input.filePath);

      if (!fs.existsSync(fullPath)) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'File not found' });
      }

      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not a file' });
      }

      if (stat.size > MAX_FILE_SIZE) {
        return {
          content: null,
          truncated: true,
          size: stat.size,
          sizeFormatted: formatSize(stat.size),
          message: `File too large to preview (${formatSize(stat.size)} > 512 KB)`,
        };
      }

      const ext = path.extname(fullPath).toLowerCase();
      const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.tar', '.gz', '.mp4', '.mov', '.mp3', '.wav'];
      if (binaryExts.includes(ext)) {
        return {
          content: null,
          truncated: false,
          size: stat.size,
          sizeFormatted: formatSize(stat.size),
          message: 'Binary file — preview not available',
        };
      }

      const content = fs.readFileSync(fullPath, 'utf-8');
      return {
        content,
        truncated: false,
        size: stat.size,
        sizeFormatted: formatSize(stat.size),
        message: null,
      };
    }),

  uploadImage: protectedProcedure
    .input(z.object({
      data: z.string(), // base64 encoded image data (without data: prefix)
      mimeType: z.string().default('image/png'),
      caption: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Ensure cache dir exists
      if (!fs.existsSync(IMAGE_CACHE_DIR)) {
        fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true });
      }

      const extMap: Record<string, string> = {
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'image/bmp': '.bmp',
      };
      const ext = extMap[input.mimeType] ?? '.png';
      const name = `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}${ext}`;
      const filePath = path.join(IMAGE_CACHE_DIR, name);

      const buffer = Buffer.from(input.data, 'base64');
      if (buffer.length > 10 * 1024 * 1024) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Image too large (max 10 MB)' });
      }

      fs.writeFileSync(filePath, buffer);

      return { path: filePath, name, size: buffer.length, sizeFormatted: formatSize(buffer.length) };
    }),

  stats: protectedProcedure.query(async () => {
    function dirSize(p: string, depth = 0): number {
      if (depth > 4) return 0;
      try {
        const entries = fs.readdirSync(p);
        let total = 0;
        for (const e of entries) {
          const full = path.join(p, e);
          try {
            const s = fs.lstatSync(full);
            if (s.isDirectory()) total += dirSize(full, depth + 1);
            else total += s.size;
          } catch { /* skip */ }
        }
        return total;
      } catch { return 0; }
    }

    const totalSize = dirSize(WORKSPACE_ROOT);
    const entries = fs.readdirSync(WORKSPACE_ROOT);
    const fileCount = entries.filter(e => {
      try { return fs.statSync(path.join(WORKSPACE_ROOT, e)).isFile(); } catch { return false; }
    }).length;
    const dirCount = entries.filter(e => {
      try { return fs.statSync(path.join(WORKSPACE_ROOT, e)).isDirectory(); } catch { return false; }
    }).length;

    return {
      root: WORKSPACE_ROOT,
      totalSize,
      totalSizeFormatted: formatSize(totalSize),
      fileCount,
      dirCount,
    };
  }),
});
