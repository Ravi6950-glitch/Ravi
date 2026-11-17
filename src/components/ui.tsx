import type { ReactNode } from "react";
import { platformOrFallback } from "@/lib/platforms/registry";

/* ------------------------------------------------------------------ icons */

export function Icon({
  path,
  size = 16,
  className = "",
  fill = false,
  strokeWidth = 1.8,
}: {
  path: string;
  size?: number;
  className?: string;
  fill?: boolean;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? "currentColor" : "none"}
      stroke={fill ? "none" : "currentColor"}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
  );
}

/** The icon set used across the app, kept in one place. */
export const ICONS = {
  home: "M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5",
  compose: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  queue: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  chart: "M3 3v18h18M7 16l4-6 4 3 5-8",
  link: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.8 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.8-1.7",
  agent: "M12 2a3 3 0 0 1 3 3v1h2a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3h-1l-4 4v-4H7a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3h2V5a3 3 0 0 1 3-3zM9 11h.01M15 11h.01",
  bulb: "M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.35.4.65.73.85",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  plus: "M12 5v14M5 12h14",
  check: "M20 6 9 17l-5-5",
  x: "M18 6 6 18M6 6l12 12",
  clock: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z",
  alert: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  info: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 16v-4M12 8h.01",
  trend: "M23 6l-9.5 9.5-5-5L1 18M17 6h6v6",
  trendDown: "M23 18l-9.5-9.5-5 5L1 6M17 18h6v-6",
  refresh: "M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15",
  trash: "M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
  eye: "M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  play: "M5 3l14 9-14 9V3z",
  pause: "M6 4h4v16H6zM14 4h4v16h-4z",
  image: "M3 3h18a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21",
  sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  chevronDown: "M6 9l6 6 6-6",
  chevronRight: "M9 18l6-6-6-6",
  chevronLeft: "M15 18l-6-6 6-6",
  copy: "M8 4h10a2 2 0 0 1 2 2v10M16 8H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2z",
  external: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3",
  filter: "M22 3H2l8 9.5V19l4 2v-8.5L22 3z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
} as const;

/* ------------------------------------------------------- platform visuals */

export function PlatformIcon({
  platform,
  size = 18,
  className = "",
}: {
  platform: string;
  size?: number;
  className?: string;
}) {
  const def = platformOrFallback(platform);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      role="img"
      aria-label={def.name}
    >
      <title>{def.name}</title>
      <path d={def.icon} />
    </svg>
  );
}

export function PlatformAvatar({
  platform,
  size = 36,
  handle,
}: {
  platform: string;
  size?: number;
  handle?: string;
}) {
  const def = platformOrFallback(platform);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[10px]"
      style={{
        width: size,
        height: size,
        // A tinted plate rather than the raw brand colour keeps 40 different
        // logos from fighting each other in a list.
        background: `color-mix(in srgb, ${def.color} 18%, transparent)`,
        color: def.color,
        border: `1px solid color-mix(in srgb, ${def.color} 32%, transparent)`,
      }}
      title={handle ? `${def.name} - ${handle}` : def.name}
    >
      <PlatformIcon platform={platform} size={Math.round(size * 0.52)} />
    </span>
  );
}

/* --------------------------------------------------------------- chrome */

export function Card({
  children,
  className = "",
  padded = true,
  id,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  /** Set when the card is an in-page anchor target. */
  id?: string;
}) {
  return (
    <section id={id} className={`card ${padded ? "p-5" : ""} ${className}`}>
      {children}
    </section>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: string;
}) {
  return (
    <header className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[0.9375rem] font-semibold">
          {icon ? <Icon path={icon} size={16} className="shrink-0 opacity-60" /> : null}
          <span className="truncate">{title}</span>
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "info" | "brand";
}) {
  const map = {
    neutral: { bg: "var(--bg-elevated)", fg: "var(--text-muted)", br: "var(--border)" },
    good: { bg: "var(--good-soft)", fg: "var(--good)", br: "transparent" },
    warn: { bg: "var(--warn-soft)", fg: "var(--warn)", br: "transparent" },
    bad: { bg: "var(--bad-soft)", fg: "var(--bad)", br: "transparent" },
    info: { bg: "var(--info-soft)", fg: "var(--info)", br: "transparent" },
    brand: { bg: "var(--brand-soft)", fg: "var(--brand-text)", br: "transparent" },
  }[tone];
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-[0.15rem] text-[0.6875rem] font-semibold tracking-wide"
      style={{ background: map.bg, color: map.fg, border: `1px solid ${map.br}` }}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span
        className="flex h-11 w-11 items-center justify-center rounded-xl"
        style={{ background: "var(--bg-elevated)", color: "var(--text-faint)" }}
      >
        <Icon path={icon} size={20} />
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p
          className="mx-auto mt-1 max-w-sm text-[0.8125rem] leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          {body}
        </p>
      </div>
      {action}
    </div>
  );
}

export function StatusDot({ status }: { status: string }) {
  const color =
    status === "CONNECTED"
      ? "var(--good)"
      : status === "ERROR" || status === "REVOKED"
        ? "var(--bad)"
        : status === "EXPIRED"
          ? "var(--warn)"
          : "var(--text-faint)";
  return (
    <span
      className="inline-block h-[7px] w-[7px] shrink-0 rounded-full"
      style={{ background: color }}
      title={status}
    />
  );
}

/* ------------------------------------------------------------ formatting */

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 10_000) return `${(n / 1000).toFixed(0)}K`;
  if (abs >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString();
}

export function formatPercent(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "0%";
  return `${(n * 100).toFixed(digits)}%`;
}

export function formatDelta(n: number): { text: string; tone: "good" | "bad" | "neutral" } {
  if (!Number.isFinite(n) || Math.abs(n) < 0.05) return { text: "0%", tone: "neutral" };
  return {
    text: `${n > 0 ? "+" : ""}${n.toFixed(n >= 10 || n <= -10 ? 0 : 1)}%`,
    tone: n > 0 ? "good" : "bad",
  };
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 31_536_000_000],
  ["month", 2_592_000_000],
  ["week", 604_800_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/** "in 3 hours" / "2 days ago" - stable between server and client. */
export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "-";
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  if (abs < 45_000) return "just now";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return rtf.format(Math.round(diff / 60_000), "minute");
}

/** Deterministic UTC formatting - avoids a server/client hydration mismatch. */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(d);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(d);
}

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_NAMES_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function statusTone(
  status: string,
): "neutral" | "good" | "warn" | "bad" | "info" | "brand" {
  switch (status) {
    case "PUBLISHED":
      return "good";
    case "PUBLISHING":
    case "SCHEDULED":
    case "QUEUED":
      return "info";
    case "NEEDS_APPROVAL":
      return "warn";
    case "PARTIAL":
      return "warn";
    case "FAILED":
      return "bad";
    case "DRAFT":
      return "neutral";
    default:
      return "neutral";
  }
}

export function statusLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}
