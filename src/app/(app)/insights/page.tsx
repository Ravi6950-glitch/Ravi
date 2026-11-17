import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { agentName, getAgent } from "@/lib/agents/registry";
import { platformOrFallback } from "@/lib/platforms/registry";
import {
  Badge,
  Card,
  EmptyState,
  Icon,
  ICONS,
  PlatformAvatar,
  formatRelative,
} from "@/components/ui";
import { markAllInsightsReadAction, markInsightReadAction, runAgentAction } from "../actions";

export const metadata: Metadata = { title: "Insights" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "action", label: "Needs action" },
  { key: "good", label: "Wins" },
] as const;

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const workspaceId = user.workspace.id;
  const canRun = ["OWNER", "ADMIN", "EDITOR"].includes(user.role);

  const tab = TABS.find((t) => t.key === params.tab)?.key ?? "all";

  const where = {
    workspaceId,
    ...(tab === "unread" ? { readAt: null } : {}),
    ...(tab === "action" ? { severity: { in: ["WARN", "CRITICAL"] } } : {}),
    ...(tab === "good" ? { severity: "GOOD" } : {}),
  };

  const [insights, unreadCount, totalCount, accountCount] = await Promise.all([
    prisma.insight.findMany({
      where,
      include: { account: true },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    prisma.insight.count({ where: { workspaceId, readAt: null } }),
    prisma.insight.count({ where: { workspaceId } }),
    prisma.socialAccount.count({ where: { workspaceId } }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.5rem] font-bold tracking-[-0.02em]">Insights</h1>
          <p className="mt-0.5 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            {totalCount} total · {unreadCount} unread · written by the agents as they run
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 ? (
            <form action={markAllInsightsReadAction}>
              <button type="submit" className="btn btn-sm">
                <Icon path={ICONS.check} size={14} />
                Mark all read
              </button>
            </form>
          ) : null}
          {canRun ? (
            <form action={runAgentAction}>
              <input type="hidden" name="agent" value="performance-analyst" />
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={accountCount === 0}
              >
                <Icon path={ICONS.refresh} size={14} />
                Analyse now
              </button>
            </form>
          ) : null}
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto" aria-label="Filter insights">
        {TABS.map((t) => {
          const on = t.key === tab;
          return (
            <Link
              key={t.key}
              href={`/insights?tab=${t.key}`}
              aria-current={on ? "page" : undefined}
              className="shrink-0 rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium"
              style={{
                background: on ? "var(--brand-soft)" : "var(--bg-elevated)",
                color: on ? "var(--brand-text)" : "var(--text-muted)",
                border: `1px solid ${on ? "transparent" : "var(--border)"}`,
              }}
            >
              {t.label}
              {t.key === "unread" && unreadCount > 0 ? (
                <span className="ml-1.5 tabular-nums opacity-70">{unreadCount}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {insights.length === 0 ? (
        <Card>
          <EmptyState
            icon={ICONS.bulb}
            title={tab === "all" ? "No insights yet" : `Nothing under "${tab}"`}
            body={
              accountCount === 0
                ? "Connect an account first. The agents need something to analyse."
                : "The Performance Analyst and Profile Auditor run on a schedule and write here. Run one now to see results immediately."
            }
            action={
              accountCount === 0 ? (
                <Link href="/accounts" className="btn btn-primary btn-sm">
                  <Icon path={ICONS.link} size={14} />
                  Connect an account
                </Link>
              ) : (
                <Link href="/agents" className="btn btn-sm">
                  <Icon path={ICONS.agent} size={14} />
                  Open the agents
                </Link>
              )
            }
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {insights.map((ins) => {
            const agentDef = getAgent(ins.agent);
            const tone =
              ins.severity === "GOOD"
                ? "good"
                : ins.severity === "WARN"
                  ? "warn"
                  : ins.severity === "CRITICAL"
                    ? "bad"
                    : "info";
            const color =
              tone === "good"
                ? "var(--good)"
                : tone === "warn"
                  ? "var(--warn)"
                  : tone === "bad"
                    ? "var(--bad)"
                    : "var(--info)";

            return (
              <li key={ins.id}>
                <Card
                  className={ins.readAt === null ? "" : "opacity-80"}
                >
                  <div className="flex flex-wrap items-start gap-3.5">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: `color-mix(in srgb, ${color} 14%, transparent)`,
                        color,
                      }}
                    >
                      <Icon
                        path={
                          ins.severity === "GOOD"
                            ? ICONS.trend
                            : ins.severity === "CRITICAL" || ins.severity === "WARN"
                              ? ICONS.alert
                              : (agentDef?.icon ?? ICONS.info)
                        }
                        size={17}
                      />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="text-[0.9375rem] font-semibold">{ins.title}</span>
                        {ins.readAt === null ? <Badge tone="brand">New</Badge> : null}
                        {ins.metricDelta !== null && ins.metric ? (
                          <Badge tone={tone}>
                            {ins.metricDelta > 0 ? "+" : ""}
                            {ins.metricDelta.toFixed(
                              Math.abs(ins.metricDelta) >= 10 ? 0 : 1,
                            )}
                            {ins.metric.includes("score") || ins.metric.includes("confidence")
                              ? ""
                              : "%"}{" "}
                            {ins.metric}
                          </Badge>
                        ) : null}
                      </p>

                      <p className="mt-1.5 whitespace-pre-wrap text-[0.875rem] leading-relaxed">
                        {ins.body}
                      </p>

                      <p
                        className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.6875rem]"
                        style={{ color: "var(--text-faint)" }}
                      >
                        <span className="flex items-center gap-1">
                          {agentDef ? <Icon path={agentDef.icon} size={11} /> : null}
                          {agentName(ins.agent)}
                        </span>
                        {ins.account ? (
                          <span className="flex items-center gap-1">
                            <PlatformAvatar platform={ins.account.platform} size={12} />
                            @{ins.account.handle} ·{" "}
                            {platformOrFallback(ins.account.platform).name}
                          </span>
                        ) : (
                          <span>all networks</span>
                        )}
                        <span>{formatRelative(ins.createdAt)}</span>
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col gap-1.5">
                      {ins.actionHref && ins.actionLabel ? (
                        <Link href={ins.actionHref} className="btn btn-sm">
                          {ins.actionLabel}
                          <Icon path={ICONS.chevronRight} size={13} />
                        </Link>
                      ) : null}
                      {ins.readAt === null ? (
                        <form action={markInsightReadAction}>
                          <input type="hidden" name="insightId" value={ins.id} />
                          <button type="submit" className="btn btn-sm w-full">
                            <Icon path={ICONS.check} size={13} />
                            Read
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
