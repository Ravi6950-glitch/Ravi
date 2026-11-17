import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { platformOrFallback } from "@/lib/platforms/registry";
import {
  Badge,
  Card,
  EmptyState,
  Icon,
  ICONS,
  PlatformAvatar,
  formatDateTime,
  formatNumber,
  formatRelative,
  statusLabel,
  statusTone,
} from "@/components/ui";
import {
  approvePostAction,
  deletePostAction,
  publishNowAction,
  retryTargetAction,
} from "../actions";
import { RescheduleControl } from "./RescheduleControl";

export const metadata: Metadata = { title: "Queue" };
export const dynamic = "force-dynamic";

type Filter = "upcoming" | "drafts" | "approval" | "published" | "failed";

const FILTERS: Array<{ key: Filter; label: string; statuses: string[] }> = [
  { key: "upcoming", label: "Upcoming", statuses: ["SCHEDULED", "QUEUED", "PUBLISHING"] },
  { key: "approval", label: "Needs approval", statuses: ["NEEDS_APPROVAL"] },
  { key: "drafts", label: "Drafts", statuses: ["DRAFT"] },
  { key: "published", label: "Published", statuses: ["PUBLISHED", "PARTIAL"] },
  { key: "failed", label: "Failed", statuses: ["FAILED"] },
];

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const workspaceId = user.workspace.id;
  const canPublish = ["OWNER", "ADMIN", "EDITOR"].includes(user.role);

  const active =
    FILTERS.find((f) => f.key === params.filter) ?? FILTERS[0];

  const [posts, counts, slotCount] = await Promise.all([
    prisma.post.findMany({
      where: { workspaceId, status: { in: active.statuses } },
      include: {
        author: { select: { name: true, avatarColor: true } },
        targets: {
          include: {
            account: true,
            metrics: { orderBy: { capturedAt: "desc" }, take: 1 },
          },
        },
        media: { include: { media: true } },
      },
      orderBy:
        active.key === "published"
          ? { publishedAt: "desc" }
          : active.key === "drafts"
            ? { updatedAt: "desc" }
            : { scheduledAt: "asc" },
      take: 60,
    }),
    Promise.all(
      FILTERS.map(async (f) => ({
        key: f.key,
        count: await prisma.post.count({
          where: { workspaceId, status: { in: f.statuses } },
        }),
      })),
    ),
    prisma.queueSlot.count({ where: { workspaceId, enabled: true } }),
  ]);

  const countFor = (key: Filter) => counts.find((c) => c.key === key)?.count ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.5rem] font-bold tracking-[-0.02em]">Queue</h1>
          <p className="mt-0.5 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            {slotCount > 0 ? (
              <>
                {slotCount} posting slot{slotCount === 1 ? "" : "s"} a week ·{" "}
                <Link href="/settings" style={{ color: "var(--brand-text)" }}>
                  change schedule
                </Link>
              </>
            ) : (
              <>
                No posting schedule yet ·{" "}
                <Link href="/settings" style={{ color: "var(--brand-text)" }}>
                  set one up
                </Link>
              </>
            )}
          </p>
        </div>
        <Link href="/composer" className="btn btn-primary btn-sm">
          <Icon path={ICONS.compose} size={14} />
          New post
        </Link>
      </header>

      {/* Filters */}
      <nav className="flex gap-1 overflow-x-auto" aria-label="Filter posts">
        {FILTERS.map((f) => {
          const on = f.key === active.key;
          const n = countFor(f.key);
          return (
            <Link
              key={f.key}
              href={`/queue?filter=${f.key}`}
              aria-current={on ? "page" : undefined}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
              style={{
                background: on ? "var(--brand-soft)" : "var(--bg-elevated)",
                color: on ? "var(--brand-text)" : "var(--text-muted)",
                border: `1px solid ${on ? "transparent" : "var(--border)"}`,
              }}
            >
              {f.label}
              {n > 0 ? (
                <span className="tabular-nums opacity-70">{n}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {posts.length === 0 ? (
        <Card>
          <EmptyState
            icon={active.key === "failed" ? ICONS.check : ICONS.calendar}
            title={
              active.key === "upcoming"
                ? "Nothing in the queue"
                : active.key === "failed"
                  ? "No failures"
                  : `No ${active.label.toLowerCase()}`
            }
            body={
              active.key === "upcoming"
                ? "Write a post and add it to the queue. It will go out in your next free slot."
                : active.key === "failed"
                  ? "Everything that has gone out, went out cleanly."
                  : "Nothing here yet."
            }
            action={
              active.key === "upcoming" ? (
                <Link href="/composer" className="btn btn-primary btn-sm">
                  <Icon path={ICONS.plus} size={14} />
                  Write a post
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {posts.map((post) => {
            const impressions = post.targets.reduce(
              (t, x) => t + (x.metrics[0]?.impressions ?? 0),
              0,
            );
            const engagements = post.targets.reduce(
              (t, x) =>
                t +
                (x.metrics[0]
                  ? x.metrics[0].likes +
                    x.metrics[0].comments +
                    x.metrics[0].shares +
                    x.metrics[0].saves
                  : 0),
              0,
            );
            const failedTargets = post.targets.filter((t) => t.status === "FAILED");

            return (
              <li key={post.id}>
                <Card>
                  <div className="flex flex-wrap items-start gap-4">
                    {/* Time column */}
                    <div className="w-[108px] shrink-0">
                      <Badge tone={statusTone(post.status)}>{statusLabel(post.status)}</Badge>
                      {post.scheduledAt || post.publishedAt ? (
                        <>
                          <p className="mt-1.5 text-[0.8125rem] font-semibold">
                            {formatDateTime(post.publishedAt ?? post.scheduledAt)}
                          </p>
                          <p className="text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                            UTC · {formatRelative(post.publishedAt ?? post.scheduledAt)}
                          </p>
                        </>
                      ) : (
                        <p
                          className="mt-1.5 text-[0.75rem]"
                          style={{ color: "var(--text-faint)" }}
                        >
                          Not scheduled
                        </p>
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      {post.title ? (
                        <p className="text-[0.75rem] font-medium" style={{ color: "var(--text-faint)" }}>
                          {post.title}
                        </p>
                      ) : null}
                      <p className="whitespace-pre-wrap text-[0.875rem] leading-relaxed">
                        {truncate(post.baseContent, 280) || "(no copy yet)"}
                      </p>

                      {post.media.length > 0 ? (
                        <ul className="mt-2 flex gap-1.5">
                          {post.media.slice(0, 5).map((pm) => (
                            <li key={pm.id}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={pm.media.url}
                                alt={pm.media.alt ?? ""}
                                className="h-12 w-12 rounded-md object-cover"
                                style={{ border: "1px solid var(--border)" }}
                                loading="lazy"
                              />
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      {/* Destinations */}
                      <ul className="mt-2.5 flex flex-wrap gap-1.5">
                        {post.targets.map((t) => {
                          const def = platformOrFallback(t.account.platform);
                          const tone =
                            t.status === "PUBLISHED"
                              ? "good"
                              : t.status === "FAILED"
                                ? "bad"
                                : t.status === "PUBLISHING"
                                  ? "info"
                                  : "neutral";
                          return (
                            <li key={t.id}>
                              {t.externalUrl ? (
                                <a
                                  href={t.externalUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="chip"
                                  style={{ color: "var(--text)" }}
                                  title={`Open on ${def.name}`}
                                >
                                  <PlatformAvatar platform={t.account.platform} size={14} />
                                  @{t.account.handle}
                                  <Icon path={ICONS.external} size={10} />
                                </a>
                              ) : (
                                <span className="chip">
                                  <PlatformAvatar platform={t.account.platform} size={14} />
                                  @{t.account.handle}
                                  <Badge tone={tone}>{statusLabel(t.status)}</Badge>
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>

                      {/* Failures, with the real reason */}
                      {failedTargets.length > 0 ? (
                        <ul className="mt-2.5 flex flex-col gap-1.5">
                          {failedTargets.map((t) => (
                            <li
                              key={t.id}
                              className="flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-1.5 text-[0.75rem]"
                              style={{ background: "var(--bad-soft)", color: "var(--bad)" }}
                            >
                              <Icon path={ICONS.alert} size={13} className="shrink-0" />
                              <span className="min-w-0 flex-1">
                                <strong>{platformOrFallback(t.account.platform).name}:</strong>{" "}
                                {t.error ?? "Unknown error"}
                                {t.attempts > 1 ? ` (${t.attempts} attempts)` : ""}
                              </span>
                              {canPublish ? (
                                <form action={retryTargetAction}>
                                  <input type="hidden" name="targetId" value={t.id} />
                                  <button type="submit" className="btn btn-sm">
                                    <Icon path={ICONS.refresh} size={12} />
                                    Retry
                                  </button>
                                </form>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      {/* Performance, once it is out */}
                      {post.status === "PUBLISHED" || post.status === "PARTIAL" ? (
                        <p
                          className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <span>
                            <strong className="tabular-nums">{formatNumber(impressions)}</strong>{" "}
                            impressions
                          </span>
                          <span>
                            <strong className="tabular-nums">{formatNumber(engagements)}</strong>{" "}
                            engagements
                          </span>
                          {impressions > 0 ? (
                            <span>
                              <strong className="tabular-nums">
                                {((engagements / impressions) * 100).toFixed(2)}%
                              </strong>{" "}
                              rate
                            </span>
                          ) : null}
                        </p>
                      ) : null}

                      <p className="mt-2 text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                        by {post.author.name}
                        {post.aiGenerated ? " · AI-assisted" : ""}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 flex-col gap-1.5">
                      {post.status !== "PUBLISHED" ? (
                        <Link href={`/composer?post=${post.id}`} className="btn btn-sm">
                          <Icon path={ICONS.compose} size={13} />
                          Edit
                        </Link>
                      ) : null}

                      {post.status === "NEEDS_APPROVAL" && canPublish ? (
                        <form action={approvePostAction}>
                          <input type="hidden" name="postId" value={post.id} />
                          <button type="submit" className="btn btn-primary btn-sm w-full">
                            <Icon path={ICONS.check} size={13} />
                            Approve
                          </button>
                        </form>
                      ) : null}

                      {canPublish &&
                      ["SCHEDULED", "QUEUED", "DRAFT", "PARTIAL", "FAILED"].includes(
                        post.status,
                      ) ? (
                        <form action={publishNowAction}>
                          <input type="hidden" name="postId" value={post.id} />
                          <button type="submit" className="btn btn-sm w-full">
                            <Icon path={ICONS.send} size={13} />
                            Send now
                          </button>
                        </form>
                      ) : null}

                      {canPublish && ["SCHEDULED", "QUEUED"].includes(post.status) ? (
                        <RescheduleControl
                          postId={post.id}
                          current={post.scheduledAt?.toISOString() ?? null}
                        />
                      ) : null}

                      {post.status !== "PUBLISHED" ? (
                        <form action={deletePostAction}>
                          <input type="hidden" name="postId" value={post.id} />
                          <button type="submit" className="btn btn-danger btn-sm w-full">
                            <Icon path={ICONS.trash} size={13} />
                            Delete
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n).trimEnd()}…`;
}
