// Connection configuration — reads from environment or uses defaults.
// In production, these are baked in at build time via NEXT_PUBLIC_ vars.
// In dev, set them in .env.local or fall back to localhost.

function getEnv(key: string, fallback: string): string {
  if (typeof window !== "undefined") {
    // Client-side: check meta tag first (allows runtime override via index.html injection)
    const meta = document.querySelector(`meta[name="${key}"]`);
    if (meta) return meta.getAttribute("content") || fallback;
  }
  // Build-time env
  return process.env[key] || fallback;
}

// Default to current origin for API (FastAPI serves both static + API on 8005)
export function getApiBase(): string {
  if (typeof window !== "undefined") {
    const override = getEnv("NEXT_PUBLIC_API_BASE", "");
    if (override) return override;
    // In production, API is same origin (FastAPI serves everything)
    return window.location.origin;
  }
  return "http://localhost:8005";
}

export function getWsUrl(): string {
  if (typeof window !== "undefined") {
    const override = getEnv("NEXT_PUBLIC_WS_URL", "");
    if (override) return override;
    // Default: same host, port 8010
    const host = window.location.hostname;
    return `ws://${host}:8010`;
  }
  return "ws://localhost:8010";
}

export const CONFIG = {
  WS_RECONNECT_DELAY: 2000,
  WS_MAX_RECONNECT_DELAY: 30000,
  REST_POLL_INTERVAL: 30000,
  MAX_TOOL_CALLS: 200,
  MAX_MESSAGES: 500,
} as const;
