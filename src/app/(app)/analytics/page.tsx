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
  SectionHeader,
  formatDelta,
  formatNumber,
  formatRelative,
  DAY_NAMES,
} from "@/components/ui";
import { AreaChart, BarChart, Heatmap, Legend, SERIES_COLORS } from "@/components/charts";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;
const RANGES = [
  { key: "7", label: "7 days", days: 7 },
  { key: "14", label: "14 days", days: 14 },
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; account?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const workspaceId = user.workspace.id;

  const range = RANGES.find((r) => r.key === params.range) ?? RANGES[1];
  const now = Date.now();
  const from = new Date(now - range.days * DAY_MS);
  const prevFrom = new Date(now - range.days * 2 * DAY_MS);

  const accounts = await prisma.socialAccount.findMany({
    where: { workspaceId },
    orderBy: { followers: "desc" },
  });

  const focus = params.account
    ? accounts.find((a) => a.id === params.account)
    : undefined;
  const scope = focus ? [focus] : accounts;
  const scopeIds = scope.map((a) => a.id);

  if (accounts.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={ICONS.chart}
          title="No analytics yet"
          body="Connect an account and Chorus starts building its history immediately - including a 30-day backfill so the charts are not empty on day one."
          action={
            <Link href="/accounts" className="btn btn-primary btn-sm">
              <Icon path={ICONS.link} size={14} />
              Connect an account
            </Link>
          }
        />
      </Card>
    );
  }

  const [snapshots, topTargets, bestTimes, audits] = await Promise.all([
    prisma.metricSnapshot.findMany({
      where: { accountId: { in: scopeIds }, date: { gte: prevFrom } },
      orderBy: { date: "asc" },
    }),
    prisma.postTarget.findMany({
      where: {
        accountId: { in: scopeIds },
        status: "PUBLISHED",
        publishedAt: { gte: from },
      },
      include: {
        post: true,
        account: true,
        metrics: { orderBy: { capturedAt: "desc" }, take: 1 },
      },
      take: 200,
    }),
    prisma.bestTime.findMany({
      where: { accountId: { in: scopeIds } },
    }),
    prisma.profileAudit.findMany({
      where: { workspaceId, accountId: { in: scopeIds } },
      orderBy: { createdAt: "desc" },
      take: scopeIds.length,
      distinct: ["accountId"],
    }),
  ]);

  const current = snapshots.filter((s) => s.date >= from);
  const previous = snapshots.filter((s) => s.date < from);
  const sum = (rows: typeof snapshots, pick: (r: typeof snapshots[number]) => number) =>
    rows.reduce((t, r) => t + pick(r), 0);
  const pct = (c: number, p: number) => (p === 0 ? (c === 0 ? 0 : 100) : ((c - p) / p) * 100);

  const totals = {
    impressions: sum(current, (r) => r.impressions),
    reach: sum(current, (r) => r.reach),
    engagements: sum(current, (r) => r.engagements),
    likes: sum(current, (r) => r.likes),
    comments: sum(current, (r) => r.comments),
    shares: sum(current, (r) => r.shares),
    saves: sum(current, (r) => r.saves),
    clicks: sum(current, (r) => r.clicks),
    videoViews: sum(current, (r) => r.videoViews),
    profileViews: sum(current, (r) => r.profileViews),
    posts: sum(current, (r) => r.postsCount),
    followers: scope.reduce((t, a) => t + a.followers, 0),
  };
  const prior = {
    impressions: sum(previous, (r) => r.impressions),
    reach: sum(previous, (r) => r.reach),
    engagements: sum(previous, (r) => r.engagements),
    clicks: sum(previous, (r) => r.clicks),
    posts: sum(previous, (r) => r.postsCount),
  };

  // Daily series
  const dayMap = new Map<string, { impressions: number; engagements: number; followers: number }>();
  for (const s of current) {
    const k = s.date.toISOString().slice(0, 10);
    const c = dayMap.get(k) ?? { impressions: 0, engagements: 0, followers: 0 };
    c.impressions += s.impressions;
    c.engagements += s.engagements;
    c.followers += s.followers;
    dayMap.set(k, c);
  }
  const days = [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b));
  const label = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

  const impressionSeries = days.map(([d, v]) => ({ label: label(d), value: v.impressions }));
  const engagementSeries = days.map(([d, v]) => ({ label: label(d), value: v.engagements }));
  const followerSeries = days.map(([d, v]) => ({ label: label(d), value: v.followers }));

  // Per-platform comparison
  const platformRows = scope
    .map((a) => {
      const rows = current.filter((s) => s.accountId === a.id);
      const prevRows = previous.filter((s) => s.accountId === a.id);
      const impressions = rows.reduce((t, r) => t + r.impressions, 0);
      const engagements = rows.reduce((t, r) => t + r.engagements, 0);
      const posts = rows.reduce((t, r) => t + r.postsCount, 0);
      return {
        account: a,
        impressions,
        engagements,
        posts,
        rate: impressions > 0 ? engagements / impressions : 0,
        perPost: posts > 0 ? engagements / posts : 0,
        impressionDelta: pct(
          impressions,
          prevRows.reduce((t, r) => t + r.impressions, 0),
        ),
        followerStart: rows.at(0)?.followers ?? a.followers,
        followerEnd: rows.at(-1)?.followers ?? a.followers,
      };
    })
    .sort((a, b) => b.engagements - a.engagements);

  // Top posts
  const topPosts = topTargets
    .map((t) => {
      const m = t.metrics[0];
      return {
        target: t,
        impressions: m?.impressions ?? 0,
        engagements: m ? m.likes + m.comments + m.shares + m.saves : 0,
        rate: m?.engagementRate ?? 0,
      };
    })
    .sort((a, b) => b.engagements - a.engagements)
    .slice(0, 10);

  const engagementBreakdown = [
    { label: "Likes", value: totals.likes, color: SERIES_COLORS[0] },
    { label: "Comments", value: totals.comments, color: SERIES_COLORS[1] },
    { label: "Shares", value: totals.shares, color: SERIES_COLORS[2] },
    { label: "Saves", value: totals.saves, color: SERIES_COLORS[3] },
  ];

  const heatCells = aggregateHeat(bestTimes);
  const engagementRate = totals.impressions > 0 ? totals.engagements / totals.impressions : 0;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.5rem] font-bold tracking-[-0.02em]">Analytics</h1>
          <p className="mt-0.5 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            {focus
              ? `${platformOrFallback(focus.platform).name} · @${focus.handle}`
              : `${accounts.length} accounts`}{" "}
            · last {range.days} days vs the {range.days} before
          </p>
        </div>
        <nav className="flex gap-1" aria-label="Date range">
          {RANGES.map((r) => {
            const on = r.key === range.key;
            return (
              <Link
                key={r.key}
                href={`/analytics?range=${r.key}${focus ? `&account=${focus.id}` : ""}`}
                aria-current={on ? "page" : undefined}
                className="rounded-lg px-2.5 py-1.5 text-[0.8125rem] font-medium"
                style={{
                  background: on ? "var(--brand-soft)" : "var(--bg-elevated)",
                  color: on ? "var(--brand-text)" : "var(--text-muted)",
                  border: `1px solid ${on ? "transparent" : "var(--border)"}`,
                }}
              >
                {r.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Account filter */}
      <nav className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Filter by account">
        <Link
          href={`/analytics?range=${range.key}`}
          className="chip shrink-0"
          style={
            !focus
              ? { background: "var(--brand-soft)", color: "var(--brand-text)", borderColor: "transparent" }
              : undefined
          }
        >
          All networks
        </Link>
        {accounts.map((a) => (
          <Link
            key={a.id}
            href={`/analytics?range=${range.key}&account=${a.id}`}
            className="chip shrink-0"
            style={
              focus?.id === a.id
                ? { background: "var(--brand-soft)", color: "var(--brand-text)", borderColor: "transparent" }
                : undefined
            }
          >
            <PlatformAvatar platform={a.platform} size={14} />@{a.handle}
          </Link>
        ))}
      </nav>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Metric label="Impressions" value={totals.impressions} delta={pct(totals.impressions, prior.impressions)} />
        <Metric label="Reach" value={totals.reach} delta={pct(totals.reach, prior.reach)} />
        <Metric
          label="Engagements"
          value={totals.engagements}
          delta={pct(totals.engagements, prior.engagements)}
        />
        <Metric label="Engagement rate" raw={`${(engagementRate * 100).toFixed(2)}%`} />
        <Metric label="Link clicks" value={totals.clicks} delta={pct(totals.clicks, prior.clicks)} />
        <Metric label="Posts" value={totals.posts} delta={pct(totals.posts, prior.posts)} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <SectionHeader title="Impressions" icon={ICONS.eye} />
          <AreaChart data={impressionSeries} height={190} valueLabel="Daily impressions" />
        </Card>
        <Card>
          <SectionHeader title="Engagements" icon={ICONS.trend} />
          <AreaChart
            data={engagementSeries}
            height={190}
            color="var(--good)"
            valueLabel="Daily engagements"
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <SectionHeader title="Audience" subtitle="Total followers in scope" icon={ICONS.users} />
          <AreaChart
            data={followerSeries}
            height={160}
            color="var(--info)"
            valueLabel="Followers"
          />
          <p className="mt-3 text-[1.25rem] font-bold tabular-nums">
            {formatNumber(totals.followers)}
          </p>
          <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
            followers right now
          </p>
        </Card>

        <Card>
          <SectionHeader title="How people engage" icon={ICONS.chart} />
          <BarChart
            data={engagementBreakdown.map((e) => ({ label: e.label, value: e.value }))}
            height={160}
            valueLabel="Engagement type"
            colors={engagementBreakdown.map((e) => e.color)}
          />
          <div className="mt-3">
            <Legend
              items={engagementBreakdown.map((e) => ({
                label: e.label,
                color: e.color,
                value: formatNumber(e.value),
              }))}
            />
          </div>
        </Card>

        <Card>
          <SectionHeader
            title="Other signals"
            subtitle="Over the selected period"
            icon={ICONS.info}
          />
          <dl className="flex flex-col gap-2 text-[0.8125rem]">
            {[
              ["Profile views", totals.profileViews],
              ["Video views", totals.videoViews],
              ["Saves", totals.saves],
              ["Shares", totals.shares],
              ["Comments", totals.comments],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex items-center justify-between">
                <dt style={{ color: "var(--text-muted)" }}>{k}</dt>
                <dd className="font-semibold tabular-nums">{formatNumber(Number(v))}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      {/* Per-network comparison */}
      <Card padded={false}>
        <div className="p-5 pb-0">
          <SectionHeader
            title="Network by network"
            subtitle="Sorted by engagements. 'Per post' is the number that tells you where effort pays off."
            icon={ICONS.link}
          />
        </div>
        <div className="overflow-x-auto px-5 pb-5">
          <table className="w-full text-left text-[0.8125rem]">
            <thead>
              <tr style={{ color: "var(--text-faint)" }}>
                <th className="pb-2 pr-3 font-medium">Account</th>
                <th className="pb-2 pr-3 text-right font-medium">Followers</th>
                <th className="pb-2 pr-3 text-right font-medium">Impressions</th>
                <th className="pb-2 pr-3 text-right font-medium">Engagements</th>
                <th className="pb-2 pr-3 text-right font-medium">Rate</th>
                <th className="pb-2 pr-3 text-right font-medium">Posts</th>
                <th className="pb-2 text-right font-medium">Per post</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
              {platformRows.map((row) => {
                const d = formatDelta(row.impressionDelta);
                const growth = row.followerEnd - row.followerStart;
                const audit = audits.find((a) => a.accountId === row.account.id);
                return (
                  <tr key={row.account.id}>
                    <td className="py-2.5 pr-3">
                      <Link
                        href={`/analytics?range=${range.key}&account=${row.account.id}`}
                        className="flex items-center gap-2"
                      >
                        <PlatformAvatar
                          platform={row.account.platform}
                          size={26}
                          handle={row.account.handle}
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">@{row.account.handle}</span>
                          <span
                            className="block truncate text-[0.6875rem]"
                            style={{ color: "var(--text-faint)" }}
                          >
                            {platformOrFallback(row.account.platform).name}
                            {audit ? ` · grade ${audit.grade}` : ""}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {formatNumber(row.account.followers)}
                      {growth !== 0 ? (
                        <span
                          className="ml-1 text-[0.6875rem]"
                          style={{ color: growth > 0 ? "var(--good)" : "var(--bad)" }}
                        >
                          {growth > 0 ? "+" : ""}
                          {formatNumber(growth)}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {formatNumber(row.impressions)}
                      <span
                        className="ml-1 text-[0.6875rem]"
                        style={{
                          color:
                            d.tone === "good"
                              ? "var(--good)"
                              : d.tone === "bad"
                                ? "var(--bad)"
                                : "var(--text-faint)",
                        }}
                      >
                        {d.text}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {formatNumber(row.engagements)}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {(row.rate * 100).toFixed(2)}%
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{row.posts}</td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">
                      {row.posts > 0 ? formatNumber(Math.round(row.perPost)) : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Best times */}
      {heatCells.length > 0 ? (
        <Card>
          <SectionHeader
            title="Best times to post"
            subtitle="Learned by the Timing Oracle from your own engagement history. Times in UTC."
            icon={ICONS.clock}
            action={
              <Link href="/settings" className="btn btn-sm">
                Use these as my schedule
              </Link>
            }
          />
          <Heatmap cells={heatCells} dayNames={DAY_NAMES} />
        </Card>
      ) : null}

      {/* Top posts */}
      <Card padded={false}>
        <div className="p-5 pb-0">
          <SectionHeader
            title="Top posts"
            subtitle={`Best performing in the last ${range.days} days`}
            icon={ICONS.trend}
          />
        </div>
        {topPosts.length === 0 ? (
          <EmptyState
            icon={ICONS.send}
            title="Nothing published in this period"
            body="Publish something and its performance shows up here within minutes."
          />
        ) : (
          <div className="overflow-x-auto px-5 pb-5">
            <table className="w-full text-left text-[0.8125rem]">
              <thead>
                <tr style={{ color: "var(--text-faint)" }}>
                  <th className="pb-2 pr-3 font-medium">Post</th>
                  <th className="pb-2 pr-3 font-medium">Network</th>
                  <th className="pb-2 pr-3 text-right font-medium">Impressions</th>
                  <th className="pb-2 pr-3 text-right font-medium">Engagements</th>
                  <th className="pb-2 pr-3 text-right font-medium">Rate</th>
                  <th className="pb-2 text-right font-medium">Published</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                {topPosts.map((p) => (
                  <tr key={p.target.id}>
                    <td className="max-w-[360px] py-2.5 pr-3">
                      <span className="line-clamp-2">
                        {(p.target.content ?? p.target.post.baseContent).slice(0, 160) ||
                          "(no copy)"}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="flex items-center gap-1.5">
                        <PlatformAvatar platform={p.target.account.platform} size={20} />
                        <span className="whitespace-nowrap text-[0.75rem]">
                          @{p.target.account.handle}
                        </span>
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {formatNumber(p.impressions)}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {formatNumber(p.engagements)}
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      <Badge tone={p.rate > 0.04 ? "good" : p.rate > 0.02 ? "info" : "neutral"}>
                        {(p.rate * 100).toFixed(2)}%
                      </Badge>
                    </td>
                    <td
                      className="py-2.5 text-right whitespace-nowrap"
                      style={{ color: "var(--text-faint)" }}
                    >
                      {formatRelative(p.target.publishedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
        {scope.some((a) => a.connection === "SANDBOX")
          ? "Some accounts in this view are in sandbox mode: their metrics are modelled from the posts' own characteristics rather than fetched from the network. Live accounts show real figures from each platform's API."
          : "Figures come from each platform's own API, refreshed by the background worker."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ fragments */

function Metric({
  label,
  value,
  raw,
  delta,
}: {
  label: string;
  value?: number;
  raw?: string;
  delta?: number;
}) {
  const d = delta === undefined ? null : formatDelta(delta);
  return (
    <div className="card p-3.5">
      <p
        className="truncate text-[0.6875rem] font-medium uppercase tracking-[0.04em]"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </p>
      <p className="mt-1 text-[1.25rem] font-bold leading-none tabular-nums">
        {raw ?? formatNumber(value ?? 0)}
      </p>
      {d ? (
        <p
          className="mt-1.5 text-[0.6875rem] font-semibold"
          style={{
            color:
              d.tone === "good"
                ? "var(--good)"
                : d.tone === "bad"
                  ? "var(--bad)"
                  : "var(--text-faint)",
          }}
        >
          {d.text}
        </p>
      ) : null}
    </div>
  );
}

/** Averages best-time scores across accounts into one workspace heatmap. */
function aggregateHeat(
  rows: Array<{ dayOfWeek: number; hour: number; score: number }>,
): Array<{ dayOfWeek: number; hour: number; score: number }> {
  const map = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    const k = `${r.dayOfWeek}-${r.hour}`;
    const c = map.get(k) ?? { total: 0, count: 0 };
    c.total += r.score;
    c.count += 1;
    map.set(k, c);
  }
  return [...map.entries()].map(([k, v]) => {
    const [dayOfWeek, hour] = k.split("-").map(Number);
    return { dayOfWeek, hour, score: v.total / v.count };
  });
}
