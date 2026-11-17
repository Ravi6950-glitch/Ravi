import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  Badge,
  Card,
  Icon,
  ICONS,
  PlatformAvatar,
  formatTime,
  statusTone,
  statusLabel,
  DAY_NAMES,
} from "@/components/ui";

export const metadata: Metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

/**
 * Month grid of everything scheduled and published.
 *
 * All dates are handled in UTC so the grid a user sees matches what the
 * scheduler will actually do - a calendar that silently shifts posts into the
 * viewer's local timezone would be worse than useless.
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const weekStart = user.workspace.weekStart === 0 ? 0 : 1;

  // "m" is an offset in months from the current one.
  const offset = Number.parseInt(params.m ?? "0", 10) || 0;
  const today = new Date();
  const anchor = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1),
  );

  const monthStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const monthEnd = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1),
  );

  // Pad the grid out to whole weeks.
  const leading = (monthStart.getUTCDay() - weekStart + 7) % 7;
  const gridStart = new Date(monthStart.getTime() - leading * 86_400_000);
  const totalCells = Math.ceil((leading + daysInMonth(anchor)) / 7) * 7;
  const gridEnd = new Date(gridStart.getTime() + totalCells * 86_400_000);

  const posts = await prisma.post.findMany({
    where: {
      workspaceId: user.workspace.id,
      OR: [
        { scheduledAt: { gte: gridStart, lt: gridEnd } },
        { publishedAt: { gte: gridStart, lt: gridEnd } },
      ],
    },
    include: { targets: { include: { account: true } } },
    orderBy: { scheduledAt: "asc" },
  });

  // Bucket by UTC day.
  const byDay = new Map<string, typeof posts>();
  for (const p of posts) {
    const when = p.publishedAt ?? p.scheduledAt;
    if (!when) continue;
    const key = when.toISOString().slice(0, 10);
    const list = byDay.get(key) ?? [];
    list.push(p);
    byDay.set(key, list);
  }

  const dayHeaders = Array.from({ length: 7 }, (_, i) => DAY_NAMES[(weekStart + i) % 7]);
  const todayKey = new Date().toISOString().slice(0, 10);
  const monthLabel = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(anchor);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.5rem] font-bold tracking-[-0.02em]">Calendar</h1>
          <p className="mt-0.5 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            {posts.length} post{posts.length === 1 ? "" : "s"} in {monthLabel} · times in UTC
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Link href={`/calendar?m=${offset - 1}`} className="btn btn-sm" aria-label="Previous month">
            <Icon path={ICONS.chevronLeft} size={14} />
          </Link>
          {offset !== 0 ? (
            <Link href="/calendar" className="btn btn-sm">
              Today
            </Link>
          ) : null}
          <Link href={`/calendar?m=${offset + 1}`} className="btn btn-sm" aria-label="Next month">
            <Icon path={ICONS.chevronRight} size={14} />
          </Link>
          <Link href="/composer" className="btn btn-primary btn-sm">
            <Icon path={ICONS.plus} size={14} />
            New post
          </Link>
        </div>
      </header>

      <Card padded={false} className="overflow-hidden">
        {/* Weekday header */}
        <div
          className="grid grid-cols-7 border-b"
          style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
        >
          {dayHeaders.map((d) => (
            <div
              key={d}
              className="px-2 py-2 text-center text-[0.6875rem] font-semibold uppercase tracking-[0.05em]"
              style={{ color: "var(--text-faint)" }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {Array.from({ length: totalCells }, (_, i) => {
            const date = new Date(gridStart.getTime() + i * 86_400_000);
            const key = date.toISOString().slice(0, 10);
            const inMonth = date.getUTCMonth() === anchor.getUTCMonth();
            const isToday = key === todayKey;
            const dayPosts = byDay.get(key) ?? [];

            return (
              <div
                key={key}
                className="min-h-[108px] border-b border-r p-1.5"
                style={{
                  borderColor: "var(--border)",
                  background: inMonth ? "transparent" : "var(--bg)",
                  opacity: inMonth ? 1 : 0.55,
                }}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[0.6875rem] font-semibold tabular-nums"
                    style={{
                      background: isToday ? "var(--brand)" : "transparent",
                      color: isToday ? "#fff" : "var(--text-muted)",
                    }}
                  >
                    {date.getUTCDate()}
                  </span>
                  {dayPosts.length > 2 ? (
                    <span className="text-[0.625rem]" style={{ color: "var(--text-faint)" }}>
                      {dayPosts.length}
                    </span>
                  ) : null}
                </div>

                <ul className="flex flex-col gap-1">
                  {dayPosts.slice(0, 3).map((p) => (
                    <li key={p.id}>
                      <Link
                        href={
                          p.status === "PUBLISHED" || p.status === "PARTIAL"
                            ? "/queue?filter=published"
                            : `/composer?post=${p.id}`
                        }
                        className="block rounded-md px-1.5 py-1 transition-colors"
                        style={{
                          background: "var(--bg-elevated)",
                          borderLeft: `2px solid ${toneColor(p.status)}`,
                        }}
                        title={`${statusLabel(p.status)} · ${p.baseContent.slice(0, 100)}`}
                      >
                        <span className="flex items-center gap-1">
                          <span
                            className="text-[0.5625rem] font-semibold tabular-nums"
                            style={{ color: "var(--text-faint)" }}
                          >
                            {formatTime(p.publishedAt ?? p.scheduledAt)}
                          </span>
                          <span className="flex -space-x-1">
                            {p.targets.slice(0, 2).map((t) => (
                              <PlatformAvatar
                                key={t.id}
                                platform={t.account.platform}
                                size={12}
                              />
                            ))}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-[0.625rem] leading-tight">
                          {p.baseContent.slice(0, 40) || "(no copy)"}
                        </span>
                      </Link>
                    </li>
                  ))}
                  {dayPosts.length > 3 ? (
                    <li className="px-1.5 text-[0.5625rem]" style={{ color: "var(--text-faint)" }}>
                      +{dayPosts.length - 3} more
                    </li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {["QUEUED", "SCHEDULED", "NEEDS_APPROVAL", "PUBLISHED", "PARTIAL", "FAILED"].map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-[0.75rem]">
            <span
              className="h-2.5 w-[3px] rounded-full"
              style={{ background: toneColor(s) }}
              aria-hidden="true"
            />
            <Badge tone={statusTone(s)}>{statusLabel(s)}</Badge>
          </span>
        ))}
      </div>
    </div>
  );
}

function toneColor(status: string): string {
  switch (status) {
    case "PUBLISHED":
      return "var(--good)";
    case "FAILED":
      return "var(--bad)";
    case "PARTIAL":
    case "NEEDS_APPROVAL":
      return "var(--warn)";
    case "SCHEDULED":
    case "QUEUED":
    case "PUBLISHING":
      return "var(--info)";
    default:
      return "var(--border-strong)";
  }
}

function daysInMonth(d: Date): number {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}
