import { prisma } from "@/lib/db";
import { platformOrFallback } from "@/lib/platforms/registry";
import { callStructured, isAiConfigured, aiModel } from "./client";
import {
  heuristicComposer,
  heuristicHashtags,
  heuristicPerformance,
  heuristicProfileAudit,
  heuristicQueueOptimizer,
  heuristicTiming,
  heuristicTrends,
} from "./heuristics";
import {
  ComposerOutput,
  HashtagOutput,
  PerformanceOutput,
  ProfileAuditOutput,
  QueueOptimizerOutput,
  TimingOutput,
  TrendOutput,
} from "./schemas";
import type {
  AccountSnapshot,
  ComposerInput,
  PerformanceInput,
  QueueInput,
  TimingInput,
} from "./inputs";

/**
 * Agent orchestration.
 *
 * Each `run*` function: gathers real workspace data, runs Claude (or the
 * heuristic engine), writes the structured result back into the product
 * (insights, heatmaps, audits) and records an AgentRun either way so the run
 * log is honest about which engine produced what.
 */

const SYSTEM_BASE = `You are an agent inside Chorus, a multi-platform social media command centre.

Rules you always follow:
- Work only from the data you are given. Never invent metrics, follower counts or post performance.
- Respect each platform's real constraints: character limits, hashtag norms, media rules.
- Be specific and concrete. "Post more consistently" is useless; "lift LinkedIn from 1 to 3 posts a week using the 08:00 Tuesday slot" is useful.
- Where the data is too thin to support a conclusion, say so rather than guessing.
- Write in plain, direct language. No marketing hype, no exclamation marks, no emoji unless the platform copy itself calls for it.`;

interface RunMeta {
  workspaceId: string;
  trigger?: "manual" | "schedule" | "event";
}

async function startRun(agent: string, meta: RunMeta, input: unknown) {
  return prisma.agentRun.create({
    data: {
      workspaceId: meta.workspaceId,
      agent,
      trigger: meta.trigger ?? "manual",
      status: "RUNNING",
      engine: isAiConfigured() ? "claude" : "heuristic",
      model: isAiConfigured() ? aiModel() : null,
      input: JSON.stringify(input).slice(0, 100_000),
    },
  });
}

async function finishRun(
  runId: string,
  patch: {
    status: "SUCCEEDED" | "FAILED";
    output?: unknown;
    summary?: string;
    engine?: string;
    model?: string | null;
    inputTokens?: number;
    outputTokens?: number;
    error?: string;
    startedAt: Date;
  },
) {
  await prisma.agentRun.update({
    where: { id: runId },
    data: {
      status: patch.status,
      output: patch.output ? JSON.stringify(patch.output).slice(0, 200_000) : null,
      summary: patch.summary?.slice(0, 1000),
      engine: patch.engine,
      model: patch.model ?? null,
      inputTokens: patch.inputTokens ?? 0,
      outputTokens: patch.outputTokens ?? 0,
      error: patch.error?.slice(0, 1000),
      durationMs: Date.now() - patch.startedAt.getTime(),
      finishedAt: new Date(),
    },
  });
}

/**
 * Runs an agent through Claude when configured, falling back to the heuristic
 * engine on any failure. A broken API key or a declined request must never
 * leave the user with nothing.
 */
async function execute<T>(opts: {
  agent: string;
  meta: RunMeta;
  input: unknown;
  schema: Parameters<typeof callStructured<T>>[0]["schema"];
  prompt: string;
  maxTokens?: number;
  heuristic: () => T;
}): Promise<{ result: T; runId: string; engine: string; note?: string }> {
  const run = await startRun(opts.agent, opts.meta, opts.input);
  const startedAt = run.startedAt;

  if (isAiConfigured()) {
    try {
      const { data, inputTokens, outputTokens, model } = await callStructured<T>({
        system: SYSTEM_BASE,
        prompt: opts.prompt,
        schema: opts.schema,
        maxTokens: opts.maxTokens,
      });
      await finishRun(run.id, {
        status: "SUCCEEDED",
        output: data,
        summary: summaryOf(data),
        engine: "claude",
        model,
        inputTokens,
        outputTokens,
        startedAt,
      });
      return { result: data, runId: run.id, engine: "claude" };
    } catch (err) {
      // Fall through to the heuristic engine, but record why.
      const message = err instanceof Error ? err.message : String(err);
      const result = opts.heuristic();
      await finishRun(run.id, {
        status: "SUCCEEDED",
        output: result,
        summary: summaryOf(result),
        engine: "heuristic",
        model: null,
        error: `Claude unavailable, used the heuristic engine: ${message}`,
        startedAt,
      });
      return {
        result,
        runId: run.id,
        engine: "heuristic",
        note: `Claude was unavailable (${message.slice(0, 160)}), so this ran on the built-in engine.`,
      };
    }
  }

  const result = opts.heuristic();
  await finishRun(run.id, {
    status: "SUCCEEDED",
    output: result,
    summary: summaryOf(result),
    engine: "heuristic",
    model: null,
    startedAt,
  });
  return { result, runId: run.id, engine: "heuristic" };
}

function summaryOf(data: unknown): string {
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (typeof o.summary === "string") return o.summary;
    if (typeof o.headline === "string") return o.headline;
  }
  return "Completed.";
}

// ---------------------------------------------------------------------------
// Data collection
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

export async function collectPerformanceInput(
  workspaceId: string,
  periodDays = 14,
): Promise<PerformanceInput> {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  const accounts = await prisma.socialAccount.findMany({ where: { workspaceId } });
  const now = Date.now();
  const currentFrom = new Date(now - periodDays * DAY_MS);
  const previousFrom = new Date(now - periodDays * 2 * DAY_MS);

  const result: PerformanceInput = {
    periodDays,
    workspaceName: workspace?.name ?? "Workspace",
    accounts: [],
    topPosts: [],
  };

  for (const account of accounts) {
    const snapshots = await prisma.metricSnapshot.findMany({
      where: { accountId: account.id, date: { gte: previousFrom } },
      orderBy: { date: "asc" },
    });
    const current = snapshots.filter((s) => s.date >= currentFrom);
    const previous = snapshots.filter((s) => s.date < currentFrom);

    const sum = (rows: typeof snapshots, pick: (r: typeof snapshots[number]) => number) =>
      rows.reduce((t, r) => t + pick(r), 0);

    result.accounts.push({
      id: account.id,
      platform: account.platform,
      handle: account.handle,
      current: {
        followers: current.at(-1)?.followers ?? account.followers,
        impressions: sum(current, (r) => r.impressions),
        reach: sum(current, (r) => r.reach),
        engagements: sum(current, (r) => r.engagements),
        clicks: sum(current, (r) => r.clicks),
        postsCount: sum(current, (r) => r.postsCount),
      },
      previous: {
        followers: previous.at(-1)?.followers ?? current.at(0)?.followers ?? account.followers,
        impressions: sum(previous, (r) => r.impressions),
        reach: sum(previous, (r) => r.reach),
        engagements: sum(previous, (r) => r.engagements),
        clicks: sum(previous, (r) => r.clicks),
        postsCount: sum(previous, (r) => r.postsCount),
      },
    });
  }

  // Top posts by engagement rate within the current window.
  const targets = await prisma.postTarget.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { gte: currentFrom },
      account: { workspaceId },
    },
    include: {
      post: true,
      account: true,
      metrics: { orderBy: { capturedAt: "desc" }, take: 1 },
    },
    take: 200,
  });

  result.topPosts = targets
    .map((t) => {
      const m = t.metrics[0];
      const content = t.content ?? t.post.baseContent;
      return {
        postId: t.postId,
        platform: t.account.platform,
        excerpt: content.replace(/\s+/g, " ").trim().slice(0, 140),
        engagements: m
          ? m.likes + m.comments + m.shares + m.saves
          : 0,
        engagementRate: m?.engagementRate ?? 0,
        publishedAt: (t.publishedAt ?? t.post.publishedAt ?? new Date()).toISOString(),
      };
    })
    .sort((a, b) => b.engagementRate - a.engagementRate || b.engagements - a.engagements)
    .slice(0, 8);

  return result;
}

export async function collectAccountSnapshots(
  workspaceId: string,
  windowDays = 30,
): Promise<AccountSnapshot[]> {
  const accounts = await prisma.socialAccount.findMany({ where: { workspaceId } });
  const from = new Date(Date.now() - windowDays * DAY_MS);
  const out: AccountSnapshot[] = [];

  for (const a of accounts) {
    const snaps = await prisma.metricSnapshot.findMany({
      where: { accountId: a.id, date: { gte: from } },
      orderBy: { date: "asc" },
    });
    const impressions = snaps.reduce((t, s) => t + s.impressions, 0);
    const engagements = snaps.reduce((t, s) => t + s.engagements, 0);
    const posts = snaps.reduce((t, s) => t + s.postsCount, 0);
    const first = snaps.at(0);
    const last = snaps.at(-1);

    out.push({
      id: a.id,
      platform: a.platform,
      handle: a.handle,
      displayName: a.displayName,
      bio: a.bio,
      avatarUrl: a.avatarUrl,
      status: a.status,
      followers: last?.followers ?? a.followers,
      following: a.following,
      postsInWindow: posts,
      followerDeltaInWindow:
        first && last ? last.followers - first.followers : 0,
      engagementRate: impressions > 0 ? engagements / impressions : 0,
      windowDays,
    });
  }
  return out;
}

export async function collectTimingInput(workspaceId: string): Promise<TimingInput> {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  const accounts = await prisma.socialAccount.findMany({ where: { workspaceId } });
  const from = new Date(Date.now() - 90 * DAY_MS);

  const result: TimingInput = { timezone: workspace?.timezone ?? "UTC", accounts: [] };

  for (const a of accounts) {
    const targets = await prisma.postTarget.findMany({
      where: { accountId: a.id, status: "PUBLISHED", publishedAt: { gte: from } },
      include: { metrics: { orderBy: { capturedAt: "desc" }, take: 1 } },
      orderBy: { publishedAt: "desc" },
      take: 120,
    });
    result.accounts.push({
      id: a.id,
      platform: a.platform,
      handle: a.handle,
      recentPosts: targets
        .filter((t) => t.publishedAt)
        .map((t) => ({
          publishedAt: t.publishedAt!.toISOString(),
          engagementRate: t.metrics[0]?.engagementRate ?? 0,
          engagements: t.metrics[0]
            ? t.metrics[0].likes + t.metrics[0].comments + t.metrics[0].shares
            : 0,
        })),
    });
  }
  return result;
}

export async function collectQueueInput(workspaceId: string): Promise<QueueInput> {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  const posts = await prisma.post.findMany({
    where: {
      workspaceId,
      status: { in: ["SCHEDULED", "QUEUED"] },
      scheduledAt: { not: null },
    },
    include: { targets: { include: { account: true } } },
    orderBy: { scheduledAt: "asc" },
    take: 100,
  });
  const bestTimes = await prisma.bestTime.findMany({
    where: { account: { workspaceId } },
  });

  return {
    timezone: workspace?.timezone ?? "UTC",
    scheduled: posts.map((p) => ({
      postId: p.id,
      scheduledAt: p.scheduledAt!.toISOString(),
      excerpt: p.baseContent.replace(/\s+/g, " ").trim().slice(0, 120),
      accountIds: p.targets.map((t) => t.accountId),
      platforms: p.targets.map((t) => t.account.platform),
    })),
    bestTimes: bestTimes.map((b) => ({
      accountId: b.accountId,
      dayOfWeek: b.dayOfWeek,
      hour: b.hour,
      score: b.score,
    })),
  };
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

function platformBrief(keys: string[]): string {
  return keys
    .map((k) => {
      const d = platformOrFallback(k);
      return `- ${k} (${d.name}): max ${d.charLimit} chars${
        d.idealChars ? `, best around ${d.idealChars}` : ""
      }, up to ${d.maxHashtags} hashtags, ${d.maxImages} image(s), ${d.maxVideos} video(s). Supports: ${d.capabilities.join(", ")}.`;
    })
    .join("\n");
}

export async function runComposer(meta: RunMeta, input: ComposerInput) {
  const prompt = `Write platform-specific copy for this idea.

IDEA
${input.idea}

BRAND VOICE
${input.brandVoice || "Clear, warm and useful. Confident without hype."}
${input.tone ? `\nTONE FOR THIS POST: ${input.tone}` : ""}
${input.callToAction ? `\nCALL TO ACTION: ${input.callToAction}` : ""}
${input.link ? `\nLINK TO INCLUDE: ${input.link}` : ""}

TARGET PLATFORMS AND THEIR LIMITS
${platformBrief(input.platforms)}

${
  input.examples?.length
    ? `COPY THAT RECENTLY PERFORMED WELL ON THESE ACCOUNTS (match what works, do not copy it):
${input.examples.map((e) => `- [${e.platform}, ${(e.engagementRate * 100).toFixed(2)}% engagement] ${e.content.slice(0, 220)}`).join("\n")}`
    : ""
}

Produce one variant per platform. Each must sit inside that platform's character limit, use no more hashtags than it allows, and be genuinely different from the others where the platforms differ - do not paste the same text everywhere. Use threadParts only for platforms whose capabilities include "thread", and leave it empty otherwise.`;

  return execute<ComposerOutput>({
    agent: "composer",
    meta,
    input,
    schema: ComposerOutput,
    prompt,
    maxTokens: 12_000,
    heuristic: () => heuristicComposer(input),
  });
}

export async function runHashtagStrategist(meta: RunMeta, input: ComposerInput) {
  const prompt = `Build hashtag and keyword sets for this post.

POST IDEA
${input.idea}

TARGET PLATFORMS AND THEIR HASHTAG LIMITS
${platformBrief(input.platforms)}

For each platform: pick tags that a real audience actually follows, mix broad reach with niche intent, and never exceed the platform's limit. Where a platform ignores hashtags, return an empty hashtag list and supply keywords to work into the copy instead.`;

  return execute<HashtagOutput>({
    agent: "hashtag-strategist",
    meta,
    input,
    schema: HashtagOutput,
    prompt,
    maxTokens: 6000,
    heuristic: () => heuristicHashtags(input),
  });
}

export async function runTimingOracle(meta: RunMeta) {
  const input = await collectTimingInput(meta.workspaceId);
  const prompt = `Work out the best times to post for each account from its own history.

WORKSPACE TIMEZONE: ${input.timezone}

ACCOUNTS AND RECENT PUBLISHED POSTS
${JSON.stringify(input.accounts, null, 1).slice(0, 60_000)}

For each account return its strongest day/hour slots, best first, with a 0-100 score. dayOfWeek is 0 for Sunday. Base the scores on the engagement rates you were given. Where an account has fewer than five published posts, say so in the reason and fall back to a sensible norm for that kind of network rather than pretending the data supports a conclusion.`;

  const run = await execute<TimingOutput>({
    agent: "timing-oracle",
    meta,
    input,
    schema: TimingOutput,
    prompt,
    maxTokens: 8000,
    heuristic: () => heuristicTiming(input),
  });

  // Persist the heatmap so the queue and composer can use it.
  for (const acc of run.result.accounts) {
    const exists = await prisma.socialAccount.findFirst({
      where: { id: acc.accountId, workspaceId: meta.workspaceId },
      select: { id: true },
    });
    if (!exists) continue; // ignore an id the model invented
    for (const slot of acc.slots) {
      const day = Math.max(0, Math.min(6, Math.round(slot.dayOfWeek)));
      const hour = Math.max(0, Math.min(23, Math.round(slot.hour)));
      await prisma.bestTime.upsert({
        where: {
          accountId_dayOfWeek_hour: { accountId: acc.accountId, dayOfWeek: day, hour },
        },
        update: { score: clamp(slot.score, 0, 100), sampleSize: 1 },
        create: {
          accountId: acc.accountId,
          dayOfWeek: day,
          hour,
          score: clamp(slot.score, 0, 100),
          sampleSize: 1,
        },
      });
    }
  }
  return run;
}

export async function runPerformanceAnalyst(meta: RunMeta, periodDays = 14) {
  const input = await collectPerformanceInput(meta.workspaceId, periodDays);
  const prompt = `Analyse this workspace's performance over the last ${periodDays} days against the ${periodDays} days before it.

DATA
${JSON.stringify(input, null, 1).slice(0, 80_000)}

Write a headline, then the insights that matter. For each insight: say what moved, by how much, and what to do about it. Separate a distribution problem (reach fell) from a content problem (reach held but engagement fell) - that distinction changes the fix. Flag accounts that published nothing. Do not pad the list: if only two things moved, return two insights.`;

  const run = await execute<PerformanceOutput>({
    agent: "performance-analyst",
    meta,
    input,
    schema: PerformanceOutput,
    prompt,
    maxTokens: 10_000,
    heuristic: () => heuristicPerformance(input),
  });

  // Write the insights into the feed.
  const accountByPlatform = new Map(input.accounts.map((a) => [a.platform, a.id]));
  for (const ins of run.result.insights.slice(0, 12)) {
    await prisma.insight.create({
      data: {
        workspaceId: meta.workspaceId,
        accountId: ins.platform ? (accountByPlatform.get(ins.platform) ?? null) : null,
        runId: run.runId,
        agent: "performance-analyst",
        severity: ins.severity,
        title: ins.title.slice(0, 200),
        body: ins.body.slice(0, 2000),
        metric: ins.metric?.slice(0, 60) ?? null,
        metricDelta: Number.isFinite(ins.metricDelta) ? ins.metricDelta : null,
        actionLabel: "Open analytics",
        actionHref: "/analytics",
      },
    });
  }
  return run;
}

export async function runProfileAuditor(meta: RunMeta) {
  const accounts = await collectAccountSnapshots(meta.workspaceId);
  const input = { accounts };
  const prompt = `Audit each connected profile and score it out of 100.

PROFILES
${JSON.stringify(accounts, null, 1).slice(0, 60_000)}

PLATFORM CONTEXT
${platformBrief([...new Set(accounts.map((a) => a.platform))])}

Judge each profile on its own network's terms - what counts as a healthy cadence on a video network is not what counts on a blog. Cover: bio quality, avatar, posting cadence, follower trajectory, engagement rate against a sensible norm for that network, and connection health. Every issue needs a specific fix someone can act on today. Return one audit per profile, using the accountId exactly as given.`;

  const run = await execute<ProfileAuditOutput>({
    agent: "profile-auditor",
    meta,
    input,
    schema: ProfileAuditOutput,
    prompt,
    maxTokens: 12_000,
    heuristic: () => heuristicProfileAudit(input),
  });

  const validIds = new Set(accounts.map((a) => a.id));
  for (const audit of run.result.audits) {
    if (!validIds.has(audit.accountId)) continue;
    await prisma.profileAudit.create({
      data: {
        workspaceId: meta.workspaceId,
        accountId: audit.accountId,
        score: clamp(Math.round(audit.score), 0, 100),
        grade: audit.grade,
        strengths: JSON.stringify(audit.strengths.slice(0, 10)),
        issues: JSON.stringify(audit.issues.slice(0, 12)),
        cadence: audit.cadence?.slice(0, 200) ?? null,
        summary: audit.summary?.slice(0, 1000) ?? null,
      },
    });

    // Surface only the high-severity findings as insights, so the feed stays
    // worth reading.
    for (const issue of audit.issues.filter((i) => i.severity === "high").slice(0, 2)) {
      await prisma.insight.create({
        data: {
          workspaceId: meta.workspaceId,
          accountId: audit.accountId,
          runId: run.runId,
          agent: "profile-auditor",
          severity: "WARN",
          title: issue.title.slice(0, 200),
          body: `${issue.detail}\n\nFix: ${issue.fix}`.slice(0, 2000),
          metric: "profile score",
          metricDelta: audit.score,
          actionLabel: "Open connections",
          actionHref: "/accounts",
        },
      });
    }
  }
  return run;
}

export async function runTrendScout(meta: RunMeta) {
  const input = await collectPerformanceInput(meta.workspaceId, 30);
  const prompt = `Produce content ideas for this workspace, grounded in what has actually worked on its own accounts.

RECENT PERFORMANCE
${JSON.stringify(input, null, 1).slice(0, 60_000)}

Give between three and six ideas. Each needs a hook that explains why someone stops scrolling, the platforms it suits, a format, and an opening draft that is genuinely usable. Prefer ideas you can justify from the data over generic advice. Where you are reaching for an evergreen idea because the data is thin, give it a lower confidence.`;

  const run = await execute<TrendOutput>({
    agent: "trend-scout",
    meta,
    input,
    schema: TrendOutput,
    prompt,
    maxTokens: 10_000,
    heuristic: () => heuristicTrends(input),
  });

  for (const idea of run.result.ideas.slice(0, 4)) {
    await prisma.insight.create({
      data: {
        workspaceId: meta.workspaceId,
        runId: run.runId,
        agent: "trend-scout",
        severity: "INFO",
        title: idea.title.slice(0, 200),
        body: `${idea.angle}\n\nFormat: ${idea.format}\n\nOpening draft: ${idea.draft}`.slice(0, 2000),
        metric: "confidence",
        metricDelta: idea.confidence,
        actionLabel: "Draft this",
        actionHref: `/composer?idea=${encodeURIComponent(idea.draft.slice(0, 300))}`,
      },
    });
  }
  return run;
}

export async function runQueueOptimizer(meta: RunMeta) {
  const input = await collectQueueInput(meta.workspaceId);
  const prompt = `Review this posting queue and propose a better running order.

QUEUE AND TIMING DATA
${JSON.stringify(input, null, 1).slice(0, 60_000)}

Rules:
- Only ever move a post to a time in the future.
- Only propose a move when the timing data genuinely supports a better slot.
- Flag clashes (two posts to the same account within half an hour), gaps longer than three days, and days carrying more than six posts.
- Use the postId values exactly as given.`;

  return execute<QueueOptimizerOutput>({
    agent: "queue-optimizer",
    meta,
    input,
    schema: QueueOptimizerOutput,
    prompt,
    maxTokens: 8000,
    heuristic: () => heuristicQueueOptimizer(input),
  });
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/** Dispatch by agent key - used by the automation scheduler and the UI. */
export async function runAgentByKey(
  agent: string,
  meta: RunMeta,
): Promise<{ engine: string; summary: string; runId: string }> {
  switch (agent) {
    case "timing-oracle": {
      const r = await runTimingOracle(meta);
      return { engine: r.engine, summary: r.result.summary, runId: r.runId };
    }
    case "performance-analyst": {
      const r = await runPerformanceAnalyst(meta);
      return { engine: r.engine, summary: r.result.headline, runId: r.runId };
    }
    case "profile-auditor": {
      const r = await runProfileAuditor(meta);
      return { engine: r.engine, summary: r.result.summary, runId: r.runId };
    }
    case "trend-scout": {
      const r = await runTrendScout(meta);
      return { engine: r.engine, summary: r.result.summary, runId: r.runId };
    }
    case "queue-optimizer": {
      const r = await runQueueOptimizer(meta);
      return { engine: r.engine, summary: r.result.summary, runId: r.runId };
    }
    default:
      throw new Error(`Agent "${agent}" cannot be run on a schedule.`);
  }
}
