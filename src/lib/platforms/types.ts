import type { PlatformDefinition } from "./registry";

/** Everything an adapter needs to publish one target. */
export interface PublishContext {
  platform: PlatformDefinition;
  /** Resolved content for this platform (override or base content). */
  content: string;
  /** Optional extra parts for networks that support threads. */
  threadParts?: string[];
  /** Absolute media URLs. */
  media: Array<{ url: string; kind: string; alt?: string | null }>;
  /** Per-post options chosen in the composer (subreddit, title, privacy...). */
  options: Record<string, string | boolean | undefined>;
  /** Decrypted per-account credentials/config. */
  credentials: Record<string, string>;
  account: {
    id: string;
    handle: string;
    displayName: string;
    externalId: string | null;
    connection: string;
  };
  link?: string | null;
  firstComment?: string | null;
}

export interface PublishResult {
  ok: boolean;
  externalPostId?: string;
  externalUrl?: string;
  /** Human-readable error, safe to show in the UI. */
  error?: string;
  /** True when the failure is worth retrying (rate limit, network, 5xx). */
  retryable?: boolean;
}

export interface PlatformAdapter {
  key: string;
  /** Live network call. Only invoked for non-sandbox accounts. */
  publish(ctx: PublishContext): Promise<PublishResult>;
  /** Optional: fetch profile stats for the analytics sync. */
  fetchProfile?(ctx: {
    credentials: Record<string, string>;
    account: PublishContext["account"];
  }): Promise<{
    followers?: number;
    following?: number;
    postCount?: number;
    bio?: string;
    avatarUrl?: string;
    displayName?: string;
  } | null>;
}

/** Shared fetch wrapper: timeouts, JSON parsing and consistent error shapes. */
export async function apiFetch(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<{ ok: boolean; status: number; body: unknown; text: string }> {
  const { timeoutMs = 20_000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...rest, signal: controller.signal });
    const text = await res.text();
    let body: unknown = text;
    const type = res.headers.get("content-type") ?? "";
    if (type.includes("json") || text.trimStart().startsWith("{") || text.trimStart().startsWith("[")) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    return { ok: res.ok, status: res.status, body, text };
  } finally {
    clearTimeout(timer);
  }
}

/** 429 and 5xx are worth another attempt; 4xx client errors are not. */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 408 || status >= 500;
}

/** Trims an upstream error body to something short and safe to display. */
export function describeError(status: number, body: unknown): string {
  const flat =
    typeof body === "string"
      ? body
      : (() => {
          const o = body as Record<string, unknown> | null;
          if (!o) return "";
          for (const k of ["message", "error_description", "error", "detail", "title"]) {
            const v = o[k];
            if (typeof v === "string" && v) return v;
            if (v && typeof v === "object") {
              const nested = (v as Record<string, unknown>).message;
              if (typeof nested === "string") return nested;
            }
          }
          return JSON.stringify(o);
        })();
  const msg = flat.replace(/\s+/g, " ").trim().slice(0, 280);
  return msg ? `HTTP ${status}: ${msg}` : `HTTP ${status}`;
}
