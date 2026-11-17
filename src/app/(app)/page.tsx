import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { platformOrFallback } from "@/lib/platforms/registry";
import { agentName } from "@/lib/agents/registry";
import { isAiConfigured } from "@/lib/agents/client";
import { workerStatus } from "@/lib/worker/scheduler";
import {
  Badge,
  Card,
  EmptyState,
  Icon,
  ICONS,
  PlatformAvatar,
  SectionHeader,
  formatDateTime,
  formatDelta,
  formatNumber,
  formatRelative,
  statusLabel,
  statusTone,
} from "@/components/ui";
import { AreaChart, Legend, SERIES_COLORS, StackedBar } from "@/components/charts";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

export default async function DashboardPage() {
  const user = await requireUser();
  const workspaceId = user.workspace.id;
  const now = Date.now();
  const from14 = new Date(now - 14 * DAY_MS);
  const from28 = new Date(now - 28 * DAY_MS);

  const [accounts, snapshots, upcoming, recentPosts, insights, lastRuns, draftCount] =
    await Promise.all([
      prisma.socialAccount.findMany({
        where: { workspaceId },
        orderBy: { followers: "desc" },
      }),
      prisma.metricSnapshot.findMany({
        where: { account: { workspaceId }, date: { gte: from28 } },
        orderBy: { date: "asc" },
      }),
      prisma.post.findMany({
        where: {
          workspaceId,
          status: { in: ["SCHEDULED", "QUEUED", "NEEDS_APPROVAL"] },
        },
        include: { targets: { include: { account: true } } },
        orderBy: { scheduledAt: "asc" },
        take: 6,
      }),
      prisma.post.findMany({
        where: { workspaceId, status: { in: ["PUBLISHED", "PARTIAL", "FAILED"] } },
        include: {
          targets: {
            include: { account: true, metrics: { orderBy: { capturedAt: "desc" }, take: 1 } },
          },
        },
        orderBy: { publishedAt: "desc" },
        take: 5,
      }),
      prisma.insight.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.agentRun.findMany({
        where: { workspaceId },
        orderBy: { startedAt: "desc" },
        take: 4,
      }),
      prisma.post.count({ where: { workspaceId, status: "DRAFT" } }),
    ]);

  // --- Totals for the current period vs the one before -------------------
  const current = snapshots.filter((s) => s.date >= from14);
  const previous = snapshots.filter((s) => s.date < from14);
  const sum = (rows: typeof snapshots, pick: (r: typeof snapshots[number]) => number) =>
    rows.reduce((t, r) => t + pick(r), 0);

  const totals = {
    followers: accounts.reduce((t, a) => t + a.followers, 0),
    impressions: sum(current, (r) => r.impressions),
    engagements: sum(current, (r) => r.engagements),
    clicks: sum(current, (r) => r.clicks),
    posts: sum(current, (r) => r.postsCount),
  };
  const prior = {
    impressions: sum(previous, (r) => r.impressions),
    engagements: sum(previous, (r) => r.engagements),
    clicks: sum(previous, (r) => r.clicks),
    posts: sum(previous, (r) => r.postsCount),
  };
  const pct = (c: number, p: number) => (p === 0 ? (c === 0 ? 0 : 100) : ((c - p) / p) * 100);
  const engagementRate = totals.impressions > 0 ? totals.engagements / totals.impressions : 0;

  // --- Daily series for the chart ---------------------------------------
  const byDay = new Map<string, { impressions: number; engagements: number }>();
  for (const s of current) {
    const key = s.date.toISOString().slice(0, 10);
    const cell = byDay.get(key) ?? { impressions: 0, engagements: 0 };
    cell.impressions += s.impressions;
    cell.engagements += s.engagements;
    byDay.set(key, cell);
  }
  const series = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({
      label: new Date(day).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }),
      value: v.impressions,
    }));

  // --- Reach split by platform ------------------------------------------
  const byPlatform = new Map<string, number>();
  for (const s of current) {
    const account = accounts.find((a) => a.id === s.accountId);
    if (!account) continue;
    byPlatform.set(account.platform, (byPlatform.get(account.platform) ?? 0) + s.reach);
  }
  const platformSplit = [...byPlatform.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([key, value], i) => ({
      label: platformOrFallback(key).name,
      value,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
    }));

  const worker = workerStatus();
  const aiOn = isAiConfigured();

  if (accounts.length === 0) {
    return <FirstRun name={user.name} />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ---------------------------------------------------------- header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.5rem] font-bold tracking-[-0.02em]">
            {greeting()}, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-0.5 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            {accounts.length} connected account{accounts.length === 1 ? "" : "s"} ·{" "}
            {upcoming.length} queued · last 14 days
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/analytics" className="btn btn-sm">
            <Icon path={ICONS.chart} size={14} />
            Analytics
          </Link>
          <Link href="/composer" className="btn btn-primary btn-sm">
            <Icon path={ICONS.compose} size={14} />
            New post
          </Link>
        </div>
      </header>

      {/* ------------------------------------------------------------ KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Followers" value={formatNumber(totals.followers)} hint="across all networks" />
        <Kpi
          label="Impressions"
          value={formatNumber(totals.impressions)}
          delta={pct(totals.impressions, prior.impressions)}
        />
        <Kpi
          label="Engagements"
          value={formatNumber(totals.engagements)}
          delta={pct(totals.engagements, prior.engagements)}
        />
        <Kpi
          label="Engagement rate"
          value={`${(engagementRate * 100).toFixed(2)}%`}
          hint="engagements / impressions"
        />
        <Kpi
          label="Posts published"
          value={String(totals.posts)}
          delta={pct(totals.posts, prior.posts)}
        />
      </div>

      {/* items-start so a short card does not stretch to match a tall
          neighbour and leave a block of dead space inside it. */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
        {/* ------------------------------------------------- reach chart */}
        <Card className="xl:col-span-2">
          <SectionHeader
            title="Impressions, last 14 days"
            subtitle={
              series.length
                ? `Peak ${formatNumber(Math.max(...series.map((s) => s.value)))} in a single day`
                : "No data for this period yet"
            }
            icon={ICONS.trend}
          />
          <AreaChart data={series} height={200} valueLabel="Daily impressions" />

          {platformSplit.length > 0 ? (
            <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--border)" }}>
              <p className="mb-2 text-[0.8125rem] font-medium">Reach by network</p>
              <StackedBar segments={platformSplit} height={8} />
              <div className="mt-2.5">
                <Legend
                  items={platformSplit.map((p) => ({
                    label: p.label,
                    color: p.color,
                    value: formatNumber(p.value),
                  }))}
                />
              </div>
            </div>
          ) : null}
        </Card>

        {/* -------------------------------------------------- what's next */}
        <Card>
          <SectionHeader
            title="Going out next"
            subtitle={draftCount > 0 ? `${draftCount} draft(s) waiting` : undefined}
            icon={ICONS.clock}
            action={
              <Link href="/queue" className="btn btn-sm">
                Queue
              </Link>
            }
          />
          {upcoming.length === 0 ? (
            <EmptyState
              icon={ICONS.calendar}
              title="Nothing scheduled"
              body="Add a post to the queue and it will go out in your next free slot."
              action={
                <Link href="/composer" className="btn btn-primary btn-sm">
                  <Icon path={ICONS.plus} size={14} />
                  Write one
                </Link>
              }
            />
          ) : (
            <ul className="flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
              {upcoming.map((post) => (
                <li key={post.id} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="flex shrink-0 flex-col items-center gap-1 pt-0.5">
                    <span className="flex -space-x-1.5">
                      {post.targets.slice(0, 3).map((t) => (
                        <PlatformAvatar
                          key={t.id}
                          platform={t.account.platform}
                          size={22}
                          handle={t.account.handle}
                        />
                      ))}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[0.8125rem] leading-snug">
                      {post.baseContent.slice(0, 120) || "(no copy yet)"}
                    </p>
                    <p
                      className="mt-1 flex items-center gap-1.5 text-[0.6875rem]"
                      style={{ color: "var(--text-faint)" }}
                    >
                      <Badge tone={statusTone(post.status)}>{statusLabel(post.status)}</Badge>
                      {post.scheduledAt ? (
                        <>
                          <span>{formatDateTime(post.scheduledAt)} UTC</span>
                          <span>· {formatRelative(post.scheduledAt)}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
        {/* ----------------------------------------------- agent insights */}
        <Card className="xl:col-span-2">
          <SectionHeader
            title="What the agents found"
            subtitle={
              aiOn
                ? "Running on Claude"
                : "Running on the built-in engine - add ANTHROPIC_API_KEY for deeper analysis"
            }
            icon={ICONS.bulb}
            action={
              <Link href="/insights" className="btn btn-sm">
                All insights
              </Link>
            }
          />
          {insights.length === 0 ? (
            <EmptyState
              icon={ICONS.agent}
              title="No insights yet"
              body="The agents run on a schedule. Give them a few minutes, or run one now from the agents page."
              action={
                <Link href="/agents" className="btn btn-sm">
                  <Icon path={ICONS.play} size={13} />
                  Run an agent
                </Link>
              }
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {insights.map((ins) => (
                <li
                  key={ins.id}
                  className="card card-hover flex gap-3 p-3"
                  style={{ background: "var(--bg-elevated)" }}
                >
                  <span
                    className="mt-[3px] flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                    style={{
                      background:
                        ins.severity === "GOOD"
                          ? "var(--good-soft)"
                          : ins.severity === "WARN"
                            ? "var(--warn-soft)"
                            : ins.severity === "CRITICAL"
                              ? "var(--bad-soft)"
                              : "var(--info-soft)",
                      color:
                        ins.severity === "GOOD"
                          ? "var(--good)"
                          : ins.severity === "WARN"
                            ? "var(--warn)"
                            : ins.severity === "CRITICAL"
                              ? "var(--bad)"
                              : "var(--info)",
                    }}
                  >
                    <Icon
                      path={
                        ins.severity === "GOOD"
                          ? ICONS.trend
                          : ins.severity === "CRITICAL" || ins.severity === "WARN"
                            ? ICONS.alert
                            : ICONS.info
                      }
                      size={13}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-[0.8125rem] font-semibold">
                      {ins.title}
                      {ins.readAt === null ? <Badge tone="brand">New</Badge> : null}
                    </p>
                    <p
                      className="mt-0.5 line-clamp-2 text-[0.75rem] leading-relaxed"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {ins.body}
                    </p>
                    <p className="mt-1 text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                      {agentName(ins.agent)} · {formatRelative(ins.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* -------------------------------------------- system + accounts */}
        <div className="flex flex-col gap-5">
          <Card>
            <SectionHeader title="Automation" icon={ICONS.shield} />
            <dl className="flex flex-col gap-2.5 text-[0.8125rem]">
              <Row
                label="Background worker"
                value={
                  worker.running ? (
                    <Badge tone="good">
                      <span className="pulse">●</span> Running
                    </Badge>
                  ) : worker.enabled ? (
                    <Badge tone="warn">Starting…</Badge>
                  ) : (
                    <Badge>Disabled</Badge>
                  )
                }
              />
              <Row label="Tick interval" value={`${worker.tickSeconds}s`} />
              <Row label="Ticks completed" value={String(worker.tickCount)} />
              <Row
                label="AI engine"
                value={aiOn ? <Badge tone="brand">Claude</Badge> : <Badge>Built-in</Badge>}
              />
              {worker.lastTick ? (
                <Row label="Last tick" value={formatRelative(worker.lastTick.at)} />
              ) : null}
            </dl>

            {lastRuns.length > 0 ? (
              <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                <p className="mb-2 text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                  Recent agent runs
                </p>
                <ul className="flex flex-col gap-1.5">
                  {lastRuns.map((run) => (
                    <li key={run.id} className="flex items-center gap-2 text-[0.75rem]">
                      <Icon
                        path={run.status === "SUCCEEDED" ? ICONS.check : ICONS.alert}
                        size={12}
                        className="shrink-0"
                      />
                      <span className="truncate">{agentName(run.agent)}</span>
                      <span className="ml-auto shrink-0" style={{ color: "var(--text-faint)" }}>
                        {formatRelative(run.startedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          <Card>
            <SectionHeader
              title="Your networks"
              icon={ICONS.link}
              action={
                <Link href="/accounts" className="btn btn-sm">
                  Manage
                </Link>
              }
            />
            <ul className="flex flex-col gap-2">
              {accounts.slice(0, 7).map((a) => (
                <li key={a.id} className="flex items-center gap-2.5">
                  <PlatformAvatar platform={a.platform} size={28} handle={a.handle} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.8125rem] font-medium">
                      @{a.handle}
                    </span>
                    <span className="block text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                      {platformOrFallback(a.platform).name}
                      {a.connection === "SANDBOX" ? " · sandbox" : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-[0.8125rem] font-semibold tabular-nums">
                    {formatNumber(a.followers)}
                  </span>
                </li>
              ))}
            </ul>
            {accounts.length > 7 ? (
              <p className="mt-2.5 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                +{accounts.length - 7} more
              </p>
            ) : null}
          </Card>
        </div>
      </div>

      {/* --------------------------------------------------- recent posts */}
      {recentPosts.length > 0 ? (
        <Card padded={false}>
          <div className="p-5 pb-0">
            <SectionHeader
              title="Recently published"
              icon={ICONS.send}
              action={
                <Link href="/analytics" className="btn btn-sm">
                  Full report
                </Link>
              }
            />
          </div>
          <div className="overflow-x-auto px-5 pb-5">
            <table className="w-full text-left text-[0.8125rem]">
              <thead>
                <tr style={{ color: "var(--text-faint)" }}>
                  <th className="pb-2 pr-3 font-medium">Post</th>
                  <th className="pb-2 pr-3 font-medium">Networks</th>
                  <th className="pb-2 pr-3 text-right font-medium">Impressions</th>
                  <th className="pb-2 pr-3 text-right font-medium">Engagements</th>
                  <th className="pb-2 text-right font-medium">Published</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                {recentPosts.map((post) => {
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
                  return (
                    <tr key={post.id}>
                      <td className="max-w-[320px] py-2.5 pr-3">
                        <span className="flex items-center gap-2">
                          <Badge tone={statusTone(post.status)}>
                            {statusLabel(post.status)}
                          </Badge>
                          <span className="truncate">
                            {post.baseContent.slice(0, 80) || "(no copy)"}
                          </span>
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="flex -space-x-1.5">
                          {post.targets.slice(0, 4).map((t) => (
                            <PlatformAvatar
                              key={t.id}
                              platform={t.account.platform}
                              size={20}
                              handle={t.account.handle}
                            />
                          ))}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {formatNumber(impressions)}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {formatNumber(engagements)}
                      </td>
                      <td
                        className="py-2.5 text-right whitespace-nowrap"
                        style={{ color: "var(--text-faint)" }}
                      >
                        {formatRelative(post.publishedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ fragments */

function Kpi({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string;
  delta?: number;
  hint?: string;
}) {
  const d = delta === undefined ? null : formatDelta(delta);
  return (
    <div className="card p-3.5">
      <p
        className="text-[0.6875rem] font-medium uppercase tracking-[0.04em]"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </p>
      <p className="mt-1 text-[1.375rem] font-bold leading-none tabular-nums">{value}</p>
      {d ? (
        <p
          className="mt-1.5 flex items-center gap-1 text-[0.6875rem] font-semibold"
          style={{
            color:
              d.tone === "good"
                ? "var(--good)"
                : d.tone === "bad"
                  ? "var(--bad)"
                  : "var(--text-faint)",
          }}
        >
          {d.tone !== "neutral" ? (
            <Icon path={d.tone === "good" ? ICONS.trend : ICONS.trendDown} size={11} />
          ) : null}
          {d.text}
          <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>vs prev</span>
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt style={{ color: "var(--text-muted)" }}>{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getUTCHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** Shown until the first account is connected. */
function FirstRun({ name }: { name: string }) {
  const steps = [
    {
      icon: ICONS.link,
      title: "Connect your networks",
      body: "46 platforms are supported. Anything without developer credentials can be connected in sandbox mode so you can build the whole workflow first.",
      href: "/accounts",
      cta: "Connect an account",
      primary: true,
    },
    {
      icon: ICONS.compose,
      title: "Write once, publish everywhere",
      body: "The composer adapts your copy per platform and warns you before you break a limit.",
      href: "/composer",
      cta: "Open composer",
    },
    {
      icon: ICONS.settings,
      title: "Set your posting schedule",
      body: "Pick the times you want to publish. Then just add posts to the queue and they fill the next free slot.",
      href: "/settings",
      cta: "Set schedule",
    },
    {
      icon: ICONS.agent,
      title: "Let the agents run",
      body: "Seven agents work in the background: auditing profiles, learning your best times, and explaining what moved.",
      href: "/agents",
      cta: "See the agents",
    },
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 py-6">
      <header>
        <h1 className="text-[1.75rem] font-bold tracking-[-0.02em]">
          Welcome to Chorus, {name.split(" ")[0]}
        </h1>
        <p className="mt-1.5 text-[0.9375rem]" style={{ color: "var(--text-muted)" }}>
          Four steps and you are running. The first one takes about a minute.
        </p>
      </header>

      <ol className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <li key={s.title} className="card card-hover flex items-start gap-4 p-4">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[0.8125rem] font-bold"
              style={{
                background: s.primary ? "var(--brand-soft)" : "var(--bg-elevated)",
                color: s.primary ? "var(--brand-text)" : "var(--text-muted)",
              }}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                <Icon path={s.icon} size={15} className="opacity-60" />
                {s.title}
              </p>
              <p
                className="mt-1 text-[0.8125rem] leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                {s.body}
              </p>
            </div>
            <Link
              href={s.href}
              className={`btn btn-sm shrink-0 ${s.primary ? "btn-primary" : ""}`}
            >
              {s.cta}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
