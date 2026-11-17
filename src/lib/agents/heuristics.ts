import { platformOrFallback } from "@/lib/platforms/registry";
import { splitIntoThread } from "@/lib/platforms/validate";
import type {
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
 * The heuristic engine.
 *
 * This is not a stub. Every agent has a real, deterministic implementation
 * here that works from the workspace's own data, so Chorus is fully functional
 * with no API key and no network. When ANTHROPIC_API_KEY is set, Claude
 * replaces these with far richer judgement - but the shapes are identical, so
 * nothing downstream changes.
 */

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

/** Trims copy to a limit without cutting a word in half. */
function fitTo(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const slice = text.slice(0, limit - 1);
  const cut = slice.lastIndexOf(" ");
  return `${(cut > limit * 0.6 ? slice.slice(0, cut) : slice).trimEnd()}…`;
}

function sentences(text: string): string[] {
  return (text.match(/[^.!?\n]+[.!?]*/g) ?? [text])
    .map((s) => s.trim())
    .filter(Boolean);
}

function titleCaseWords(text: string, max: number): string[] {
  const stop = new Set([
    "the", "and", "for", "with", "that", "this", "from", "your", "you", "are",
    "but", "not", "all", "can", "has", "have", "was", "were", "will", "just",
    "how", "why", "what", "when", "our", "out", "its", "into", "more", "than",
    "them", "they", "then", "their", "about", "over", "been", "also", "only",
  ]);
  const seen = new Set<string>();
  const words: string[] = [];
  for (const raw of text.toLowerCase().match(/[a-z][a-z0-9'-]{2,}/g) ?? []) {
    const w = raw.replace(/[^a-z0-9]/g, "");
    if (w.length < 4 || stop.has(w) || seen.has(w)) continue;
    seen.add(w);
    words.push(w);
    if (words.length >= max) break;
  }
  return words;
}

export function heuristicComposer(input: ComposerInput): ComposerOutput {
  const idea = input.idea.trim();
  const base = sentences(idea);
  const hook = base[0] ?? idea;
  const body = base.slice(1).join(" ");
  const keywords = titleCaseWords(idea, 12);

  const variants = input.platforms.map((key) => {
    const def = platformOrFallback(key);
    const tagBudget = Math.min(def.maxHashtags, 8);
    const tags = keywords.slice(0, tagBudget).map((w) => w.replace(/-/g, ""));
    const tagLine = tags.length ? tags.map((t) => `#${t}`).join(" ") : "";

    let content: string;
    let rationale: string;
    let threadParts: string[] = [];

    if (def.charLimit <= 320) {
      // Short-form: lead with the hook, keep one or two tags at most.
      const shortTags = tags.slice(0, Math.min(2, def.maxHashtags));
      const tail = shortTags.length ? `\n\n${shortTags.map((t) => `#${t}`).join(" ")}` : "";
      const room = def.charLimit - tail.length;
      content = fitTo(hook, room) + tail;
      rationale = `Hook-first and tight for the ${def.charLimit}-character limit.`;
      if (def.capabilities.includes("thread") && body.length > 40) {
        threadParts = splitIntoThread(body, def.charLimit).slice(0, 4);
        rationale = `Hook in the first post, the detail continues as a thread.`;
      }
    } else if (def.key === "linkedin") {
      const open = fitTo(hook, 200);
      content = fitTo(
        `${open}\n\n${body}\n\n${input.callToAction ? `${input.callToAction}\n\n` : ""}${tagLine}`.trim(),
        def.charLimit,
      );
      rationale = "Opens with a standalone hook above the 'see more' fold, then the detail.";
    } else if (def.category === "blogging") {
      content = fitTo(
        `${hook}\n\n${body}\n\n${input.callToAction ?? ""}`.trim(),
        def.charLimit,
      );
      rationale = "Long-form structure - a lede, then the body.";
    } else if (def.maxHashtags >= 10) {
      content = fitTo(
        `${hook}\n\n${body}\n\n${input.callToAction ? `${input.callToAction}\n\n` : ""}${tagLine}`.trim(),
        def.charLimit,
      );
      rationale = `Caption plus a ${tags.length}-tag set, which ${def.name} rewards.`;
    } else {
      content = fitTo(
        `${hook}${body ? `\n\n${body}` : ""}${tagLine ? `\n\n${tagLine}` : ""}`,
        def.charLimit,
      );
      rationale = `Balanced for ${def.name}.`;
    }

    return { platform: key, content, rationale, hashtags: tags, threadParts };
  });

  const firstComment = input.link
    ? `More detail here: ${input.link}`
    : keywords.length
      ? `Happy to go deeper on ${keywords[0]} if that is useful.`
      : "";

  return {
    variants,
    firstComment,
    summary: `Adapted one idea into ${variants.length} platform-specific draft(s) from your brand voice.`,
  };
}

// ---------------------------------------------------------------------------
// Hashtag strategist
// ---------------------------------------------------------------------------

export function heuristicHashtags(input: ComposerInput): HashtagOutput {
  const words = titleCaseWords(`${input.idea} ${input.brandVoice ?? ""}`, 20);
  const sets = input.platforms.map((key) => {
    const def = platformOrFallback(key);
    if (def.maxHashtags === 0) {
      return {
        platform: key,
        hashtags: [],
        keywords: words.slice(0, 5),
        reach: "niche" as const,
        note: `${def.name} ignores hashtags - these are keywords for the copy instead.`,
      };
    }
    const count = Math.min(def.maxHashtags, Math.max(3, Math.round(def.maxHashtags * 0.7)));
    const chosen = words.slice(0, count).map((w) => w.replace(/-/g, ""));
    // A deliberate mix: broad tags reach, niche tags convert.
    const reach: "broad" | "balanced" | "niche" =
      count >= 12 ? "broad" : count >= 5 ? "balanced" : "niche";
    return {
      platform: key,
      hashtags: chosen,
      keywords: words.slice(0, 6),
      reach,
      note: `${chosen.length} tags - ${def.name} performs best at or below ${def.maxHashtags}.`,
    };
  });
  return {
    sets,
    summary: `Built tag sets for ${sets.length} platform(s), sized to each network's sweet spot.`,
  };
}

// ---------------------------------------------------------------------------
// Timing oracle
// ---------------------------------------------------------------------------

/**
 * Scores each day/hour cell from the account's own post history, then falls
 * back to sensible defaults where there is not enough data to be confident.
 */
export function heuristicTiming(input: TimingInput): TimingOutput {
  const accounts = input.accounts.map((account) => {
    const grid = new Map<string, { total: number; count: number }>();

    for (const p of account.recentPosts) {
      const d = new Date(p.publishedAt);
      if (Number.isNaN(d.getTime())) continue;
      const k = `${d.getUTCDay()}-${d.getUTCHours()}`;
      const cell = grid.get(k) ?? { total: 0, count: 0 };
      cell.total += p.engagementRate;
      cell.count += 1;
      grid.set(k, cell);
    }

    const observed = [...grid.entries()].map(([k, v]) => {
      const [day, hour] = k.split("-").map(Number);
      return { dayOfWeek: day, hour, avg: v.total / v.count, count: v.count };
    });

    const best = observed
      .filter((o) => o.count >= 1)
      .sort((a, b) => b.avg - a.avg || b.count - a.count)
      .slice(0, 8);

    const slots = best.map((o) => ({
      dayOfWeek: o.dayOfWeek,
      hour: o.hour,
      // Engagement rates are small percentages; scale to a 0-100 confidence
      // and let sample size add weight.
      score: Math.min(100, Math.round(o.avg * 900 + Math.min(o.count, 6) * 4)),
      reason: `${o.count} post(s) here averaged ${(o.avg * 100).toFixed(2)}% engagement.`,
    }));

    // Not enough history yet - use per-category norms rather than nothing.
    if (slots.length < 3) {
      const def = platformOrFallback(account.platform);
      const defaults = defaultSlotsFor(def.category);
      for (const d of defaults) {
        if (slots.length >= 5) break;
        if (slots.some((s) => s.dayOfWeek === d.dayOfWeek && s.hour === d.hour)) continue;
        slots.push({
          ...d,
          reason: "Baseline for this type of network - not enough history yet.",
        });
      }
    }

    return { accountId: account.id, slots };
  });

  return {
    accounts,
    summary: `Recalculated best-time heatmaps for ${accounts.length} account(s).`,
  };
}

function defaultSlotsFor(category: string): Array<{ dayOfWeek: number; hour: number; score: number }> {
  switch (category) {
    case "business":
      // Professional audiences skew to weekday working hours.
      return [
        { dayOfWeek: 2, hour: 8, score: 74 },
        { dayOfWeek: 3, hour: 12, score: 70 },
        { dayOfWeek: 4, hour: 8, score: 68 },
        { dayOfWeek: 2, hour: 17, score: 62 },
        { dayOfWeek: 1, hour: 9, score: 60 },
      ];
    case "video":
    case "regional":
      // Video consumption peaks in the evening and at weekends.
      return [
        { dayOfWeek: 5, hour: 19, score: 76 },
        { dayOfWeek: 6, hour: 11, score: 72 },
        { dayOfWeek: 0, hour: 20, score: 70 },
        { dayOfWeek: 3, hour: 21, score: 64 },
        { dayOfWeek: 4, hour: 18, score: 62 },
      ];
    case "blogging":
      return [
        { dayOfWeek: 2, hour: 7, score: 70 },
        { dayOfWeek: 4, hour: 7, score: 66 },
        { dayOfWeek: 1, hour: 10, score: 60 },
        { dayOfWeek: 3, hour: 15, score: 56 },
        { dayOfWeek: 6, hour: 9, score: 52 },
      ];
    default:
      return [
        { dayOfWeek: 2, hour: 11, score: 72 },
        { dayOfWeek: 4, hour: 18, score: 70 },
        { dayOfWeek: 6, hour: 10, score: 66 },
        { dayOfWeek: 1, hour: 12, score: 62 },
        { dayOfWeek: 0, hour: 19, score: 58 },
      ];
  }
}

// ---------------------------------------------------------------------------
// Performance analyst
// ---------------------------------------------------------------------------

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

export function heuristicPerformance(input: PerformanceInput): PerformanceOutput {
  const insights: PerformanceOutput["insights"] = [];
  const recommendations: string[] = [];

  let totalCurrentEng = 0;
  let totalPreviousEng = 0;

  for (const a of input.accounts) {
    totalCurrentEng += a.current.engagements;
    totalPreviousEng += a.previous.engagements;

    const engDelta = pctChange(a.current.engagements, a.previous.engagements);
    const reachDelta = pctChange(a.current.reach, a.previous.reach);
    const followerDelta = a.current.followers - a.previous.followers;
    const def = platformOrFallback(a.platform);

    // Engagement moves worth talking about.
    if (Math.abs(engDelta) >= 15 && a.previous.engagements > 0) {
      insights.push({
        severity: engDelta > 0 ? "GOOD" : engDelta < -30 ? "CRITICAL" : "WARN",
        title: `${def.name} engagement ${engDelta > 0 ? "up" : "down"} ${Math.abs(engDelta).toFixed(0)}%`,
        body:
          engDelta > 0
            ? `${a.handle} drew ${a.current.engagements.toLocaleString()} interactions against ${a.previous.engagements.toLocaleString()} the period before. Whatever changed here is worth repeating - check which posts carried it and do more of that shape.`
            : `${a.handle} fell to ${a.current.engagements.toLocaleString()} interactions from ${a.previous.engagements.toLocaleString()}. Reach moved ${reachDelta.toFixed(0)}% over the same window, so this looks ${Math.abs(reachDelta) > 15 ? "like a distribution problem rather than a content one" : "like a content problem rather than a distribution one"}.`,
        platform: a.platform,
        metric: "engagements",
        metricDelta: Number(engDelta.toFixed(1)),
      });
    }

    // A reach collapse that engagement does not explain usually means the
    // network stopped showing the account.
    if (reachDelta < -25 && a.previous.reach > 100) {
      insights.push({
        severity: "WARN",
        title: `${def.name} reach dropped ${Math.abs(reachDelta).toFixed(0)}%`,
        body: `${a.handle} reached ${a.current.reach.toLocaleString()} accounts, down from ${a.previous.reach.toLocaleString()}. Posting frequency over the window was ${a.current.postsCount} post(s). If that is lower than usual, raise cadence before changing anything else.`,
        platform: a.platform,
        metric: "reach",
        metricDelta: Number(reachDelta.toFixed(1)),
      });
      recommendations.push(
        `Rebuild cadence on ${def.name} - aim for ${Math.max(3, a.previous.postsCount)} posts in the next period.`,
      );
    }

    if (followerDelta < 0) {
      insights.push({
        severity: Math.abs(followerDelta) > a.previous.followers * 0.02 ? "WARN" : "INFO",
        title: `${def.name} lost ${Math.abs(followerDelta).toLocaleString()} followers`,
        body: `${a.handle} went from ${a.previous.followers.toLocaleString()} to ${a.current.followers.toLocaleString()}. Small dips are normal churn; look at what you posted just before the drop started.`,
        platform: a.platform,
        metric: "followers",
        metricDelta: Number(pctChange(a.current.followers, a.previous.followers).toFixed(1)),
      });
    } else if (followerDelta > 0 && a.previous.followers > 0) {
      const growth = pctChange(a.current.followers, a.previous.followers);
      if (growth >= 3) {
        insights.push({
          severity: "GOOD",
          title: `${def.name} grew ${growth.toFixed(1)}%`,
          body: `${a.handle} added ${followerDelta.toLocaleString()} followers. Growth at this rate usually traces back to one or two posts - find them in the post table and make more like them.`,
          platform: a.platform,
          metric: "followers",
          metricDelta: Number(growth.toFixed(1)),
        });
      }
    }

    if (a.current.postsCount === 0 && a.previous.postsCount > 0) {
      insights.push({
        severity: "WARN",
        title: `Nothing published on ${def.name}`,
        body: `${a.handle} had no posts this period after ${a.previous.postsCount} last period. Gaps cost more on ${def.name} than a weaker post would.`,
        platform: a.platform,
        metric: "posts",
        metricDelta: -100,
      });
      recommendations.push(`Queue at least one post for ${def.name} this week.`);
    }
  }

  // Which platform is actually paying off per post?
  const ranked = input.accounts
    .filter((a) => a.current.postsCount > 0)
    .map((a) => ({
      platform: a.platform,
      handle: a.handle,
      perPost: a.current.engagements / Math.max(1, a.current.postsCount),
    }))
    .sort((a, b) => b.perPost - a.perPost);

  if (ranked.length >= 2) {
    const top = ranked[0];
    const bottom = ranked[ranked.length - 1];
    if (top.perPost > bottom.perPost * 2.5) {
      insights.push({
        severity: "INFO",
        title: `${platformOrFallback(top.platform).name} returns ${(top.perPost / Math.max(1, bottom.perPost)).toFixed(1)}x more per post`,
        body: `Each post on ${top.handle} earned about ${Math.round(top.perPost).toLocaleString()} interactions, against ${Math.round(bottom.perPost).toLocaleString()} on ${bottom.handle}. Effort is better spent where it compounds - consider shifting some of the ${platformOrFallback(bottom.platform).name} slots across.`,
        platform: top.platform,
        metric: "engagements per post",
        metricDelta: Number((((top.perPost - bottom.perPost) / Math.max(1, bottom.perPost)) * 100).toFixed(1)),
      });
      recommendations.push(
        `Move one weekly slot from ${platformOrFallback(bottom.platform).name} to ${platformOrFallback(top.platform).name}.`,
      );
    }
  }

  if (input.topPosts.length > 0) {
    const best = input.topPosts[0];
    insights.push({
      severity: "GOOD",
      title: "Your strongest post this period",
      body: `"${best.excerpt}" on ${platformOrFallback(best.platform).name} hit ${best.engagements.toLocaleString()} interactions at a ${(best.engagementRate * 100).toFixed(2)}% rate. That is the template - same structure, new subject.`,
      platform: best.platform,
      metric: "engagement rate",
      metricDelta: Number((best.engagementRate * 100).toFixed(2)),
    });
  }

  const overall = pctChange(totalCurrentEng, totalPreviousEng);
  const headline =
    input.accounts.length === 0
      ? "No connected accounts yet - connect one to start tracking performance."
      : `Engagement across ${input.accounts.length} account(s) ${
          overall >= 0 ? "rose" : "fell"
        } ${Math.abs(overall).toFixed(0)}% versus the previous ${input.periodDays} days.`;

  if (insights.length === 0) {
    insights.push({
      severity: "INFO",
      title: "Steady period, nothing unusual",
      body: `Nothing moved more than 15% in either direction across ${input.accounts.length} account(s). A flat period is a fine time to test a new format rather than defend the current one.`,
      platform: "",
      metric: "engagements",
      metricDelta: Number(overall.toFixed(1)),
    });
  }

  if (recommendations.length === 0) {
    recommendations.push("Keep the current cadence and test one new format this week.");
  }

  return { headline, insights: insights.slice(0, 12), recommendations: recommendations.slice(0, 6) };
}

// ---------------------------------------------------------------------------
// Profile auditor
// ---------------------------------------------------------------------------

export function heuristicProfileAudit(input: {
  accounts: AccountSnapshot[];
}): ProfileAuditOutput {
  const audits = input.accounts.map((a) => {
    const def = platformOrFallback(a.platform);
    const issues: ProfileAuditOutput["audits"][number]["issues"] = [];
    const strengths: string[] = [];
    let score = 100;

    // --- Bio ---------------------------------------------------------------
    const bioLen = (a.bio ?? "").trim().length;
    if (bioLen === 0) {
      score -= 18;
      issues.push({
        title: "No bio",
        detail: `${def.name} profiles with an empty bio convert visitors at a fraction of the rate. This is the cheapest fix available.`,
        severity: "high",
        fix: "Write a one-line bio: who you help, what you post, and one reason to follow.",
      });
    } else if (bioLen < 40) {
      score -= 8;
      issues.push({
        title: "Bio is very short",
        detail: `${bioLen} characters leaves out what someone needs to decide whether to follow.`,
        severity: "medium",
        fix: "Expand to 80-150 characters covering who it is for and what they get.",
      });
    } else {
      strengths.push("Bio is filled in and long enough to say something.");
    }

    // --- Avatar ------------------------------------------------------------
    if (!a.avatarUrl) {
      score -= 10;
      issues.push({
        title: "No profile picture",
        detail: "A default avatar reads as abandoned or automated on every network.",
        severity: "high",
        fix: "Upload a clear logo or face shot, at least 400x400.",
      });
    } else {
      strengths.push("Profile picture is set.");
    }

    // --- Cadence -----------------------------------------------------------
    const days = Math.max(1, a.windowDays);
    const perWeek = (a.postsInWindow / days) * 7;
    let cadence: string;
    if (a.postsInWindow === 0) {
      score -= 25;
      cadence = "Dormant - nothing published in the window";
      issues.push({
        title: "Profile is dormant",
        detail: `No posts in the last ${days} days. Most networks reduce distribution for accounts that stop posting.`,
        severity: "high",
        fix: "Publish something this week, then hold a minimum of one post a week.",
      });
    } else if (perWeek < 1) {
      score -= 14;
      cadence = `About ${perWeek.toFixed(1)} posts a week - below the floor`;
      issues.push({
        title: "Posting too rarely to build momentum",
        detail: `${perWeek.toFixed(1)} posts a week is under the point where ${def.name} keeps showing an account to its followers.`,
        severity: "medium",
        fix: "Lift to 3 posts a week using the queue so it does not depend on remembering.",
      });
    } else if (perWeek > 35) {
      score -= 8;
      cadence = `Very high - about ${perWeek.toFixed(0)} posts a week`;
      issues.push({
        title: "Posting volume may be fatiguing followers",
        detail: `${perWeek.toFixed(0)} posts a week on ${def.name} is high enough that each one competes with your own others.`,
        severity: "low",
        fix: "Cut to your best 40% and watch whether per-post engagement rises.",
      });
    } else {
      cadence = `Healthy - about ${perWeek.toFixed(1)} posts a week`;
      strengths.push(`Consistent cadence at roughly ${perWeek.toFixed(1)} posts a week.`);
    }

    // --- Engagement quality ------------------------------------------------
    const er = a.engagementRate;
    const benchmark = benchmarkEngagement(def.category);
    if (a.followers > 50 && er > 0) {
      if (er >= benchmark * 1.3) {
        strengths.push(
          `Engagement rate of ${(er * 100).toFixed(2)}% is well above the ${(benchmark * 100).toFixed(1)}% norm for this kind of network.`,
        );
      } else if (er < benchmark * 0.5) {
        score -= 12;
        issues.push({
          title: "Engagement rate below par",
          detail: `${(er * 100).toFixed(2)}% against a ${(benchmark * 100).toFixed(1)}% norm for ${def.name}. Followers are there but not reacting.`,
          severity: "medium",
          fix: "Open the next five posts with a question or a concrete claim instead of a summary.",
        });
      }
    }

    // --- Follower trajectory ----------------------------------------------
    if (a.followerDeltaInWindow < 0) {
      score -= 10;
      issues.push({
        title: "Follower count is shrinking",
        detail: `Down ${Math.abs(a.followerDeltaInWindow).toLocaleString()} over ${days} days.`,
        severity: "medium",
        fix: "Review what you published just before the decline started and stop that format.",
      });
    } else if (a.followerDeltaInWindow > 0) {
      strengths.push(`Added ${a.followerDeltaInWindow.toLocaleString()} followers in the window.`);
    }

    // --- Token health ------------------------------------------------------
    if (a.status !== "CONNECTED") {
      score -= 20;
      issues.push({
        title: "Connection is not healthy",
        detail: `Chorus reports this account as ${a.status}. Scheduled posts to it will fail.`,
        severity: "high",
        fix: "Reconnect the account from the Connections page.",
      });
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    const grade: "A" | "B" | "C" | "D" | "F" =
      score >= 90 ? "A" : score >= 78 ? "B" : score >= 62 ? "C" : score >= 45 ? "D" : "F";

    return {
      accountId: a.id,
      score,
      grade,
      summary:
        issues.length === 0
          ? `${a.handle} is in good shape - nothing needs attention right now.`
          : `${a.handle} scores ${score}/100. ${issues.filter((i) => i.severity === "high").length} high-priority item(s) to fix.`,
      cadence,
      strengths: strengths.length ? strengths : ["Account is connected and reachable."],
      issues,
    };
  });

  return {
    audits,
    summary: `Audited ${audits.length} profile(s). Average score ${
      audits.length
        ? Math.round(audits.reduce((s, a) => s + a.score, 0) / audits.length)
        : 0
    }/100.`,
  };
}

/** Rough engagement-rate norms by network type. */
function benchmarkEngagement(category: string): number {
  switch (category) {
    case "video":
      return 0.045;
    case "social":
      return 0.025;
    case "business":
      return 0.02;
    case "blogging":
      return 0.012;
    case "messaging":
      return 0.06;
    default:
      return 0.022;
  }
}

// ---------------------------------------------------------------------------
// Trend scout
// ---------------------------------------------------------------------------

export function heuristicTrends(input: PerformanceInput): TrendOutput {
  const ideas: TrendOutput["ideas"] = [];
  const platforms = input.accounts.map((a) => a.platform);

  // Build ideas out of what actually worked, rather than generic advice.
  for (const post of input.topPosts.slice(0, 3)) {
    const def = platformOrFallback(post.platform);
    ideas.push({
      title: `Follow up on what worked on ${def.name}`,
      angle: `Your post "${post.excerpt}" pulled ${post.engagements.toLocaleString()} interactions. The same structure applied to the next subject usually carries most of that performance over.`,
      platforms: [post.platform, ...platforms.filter((p) => p !== post.platform).slice(0, 2)],
      format: def.capabilities.includes("carousel")
        ? "carousel"
        : def.capabilities.includes("thread")
          ? "text thread"
          : "single post",
      draft: `${post.excerpt.replace(/[.…]+$/, "")} - and here is the part most people miss:`,
      confidence: 78,
    });
  }

  // Networks with an account but no recent posting are the clearest gap.
  const quiet = input.accounts.filter((a) => a.current.postsCount === 0);
  for (const a of quiet.slice(0, 2)) {
    const def = platformOrFallback(a.platform);
    ideas.push({
      title: `Restart ${def.name} with a low-effort format`,
      angle: `${a.handle} has ${a.current.followers.toLocaleString()} followers and published nothing this period. Getting back in front of them matters more than the first post being perfect.`,
      platforms: [a.platform],
      format: def.capabilities.includes("video") ? "short video" : "single post",
      draft: `A quick one for anyone who has been here a while:`,
      confidence: 64,
    });
  }

  const evergreen: Array<{ title: string; angle: string; format: string; draft: string }> = [
    {
      title: "Show the process, not the result",
      angle:
        "Finished work gets admiration; work in progress gets replies. Replies are what the ranking systems actually weigh.",
      format: "carousel",
      draft: "Three things that broke before this worked:",
    },
    {
      title: "Answer the question you keep getting asked",
      angle:
        "If it comes up in your replies more than twice, it is a post. The demand is already proven.",
      format: "text thread",
      draft: "The question I get most often, answered properly this time:",
    },
    {
      title: "Take a position and defend it",
      angle:
        "A clear claim outperforms a balanced summary, because people share things they agree or disagree with - not things they merely note.",
      format: "single post",
      draft: "An unpopular opinion that has held up for me:",
    },
  ];

  for (const e of evergreen) {
    if (ideas.length >= 6) break;
    ideas.push({
      ...e,
      platforms: platforms.slice(0, 3),
      confidence: 58,
    });
  }

  return {
    ideas,
    summary: `${ideas.length} idea(s), weighted towards formats that already worked on your own accounts.`,
  };
}

// ---------------------------------------------------------------------------
// Queue optimizer
// ---------------------------------------------------------------------------

export function heuristicQueueOptimizer(input: QueueInput): QueueOptimizerOutput {
  const moves: QueueOptimizerOutput["moves"] = [];
  const warnings: QueueOptimizerOutput["warnings"] = [];

  const scheduled = [...input.scheduled].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );

  if (scheduled.length === 0) {
    warnings.push({
      kind: "empty",
      detail: "Nothing is scheduled. The queue cannot help until there is something in it.",
    });
    return { moves, warnings, summary: "Queue is empty." };
  }

  // Clashes: two posts to the same account inside 30 minutes compete with
  // each other for the same impressions.
  for (let i = 1; i < scheduled.length; i++) {
    const prev = scheduled[i - 1];
    const curr = scheduled[i];
    const gapMin =
      (new Date(curr.scheduledAt).getTime() - new Date(prev.scheduledAt).getTime()) / 60000;
    if (gapMin < 30 && prev.accountIds.some((id) => curr.accountIds.includes(id))) {
      warnings.push({
        kind: "clash",
        detail: `Two posts hit the same account ${Math.round(gapMin)} minutes apart on ${new Date(prev.scheduledAt).toUTCString().slice(0, 16)}. Space them out.`,
      });
    }
  }

  // Gaps: more than three days with nothing going out.
  for (let i = 1; i < scheduled.length; i++) {
    const gapDays =
      (new Date(scheduled[i].scheduledAt).getTime() -
        new Date(scheduled[i - 1].scheduledAt).getTime()) /
      86_400_000;
    if (gapDays > 3) {
      warnings.push({
        kind: "gap",
        detail: `${Math.round(gapDays)} days with nothing scheduled after ${new Date(scheduled[i - 1].scheduledAt).toUTCString().slice(0, 16)}.`,
      });
    }
  }

  // Overload: too much in one day.
  const perDay = new Map<string, number>();
  for (const s of scheduled) {
    const k = new Date(s.scheduledAt).toISOString().slice(0, 10);
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  for (const [day, count] of perDay) {
    if (count > 6) {
      warnings.push({
        kind: "overload",
        detail: `${count} posts scheduled on ${day}. Consider moving some to the quieter days around it.`,
      });
    }
  }

  // Moves: shift posts onto a stronger slot from the heatmap, but only when
  // the gain is meaningful and the new time is still in the future.
  const now = Date.now();
  for (const s of scheduled) {
    const at = new Date(s.scheduledAt);
    const currentScore = scoreOf(input.bestTimes, s.accountIds, at.getUTCDay(), at.getUTCHours());
    let bestCell: { day: number; hour: number; score: number } | null = null;

    for (const bt of input.bestTimes) {
      if (!s.accountIds.includes(bt.accountId)) continue;
      if (!bestCell || bt.score > bestCell.score) {
        bestCell = { day: bt.dayOfWeek, hour: bt.hour, score: bt.score };
      }
    }
    if (!bestCell || bestCell.score <= currentScore + 15) continue;

    // Nearest future occurrence of that weekday/hour.
    const target = new Date(at);
    target.setUTCHours(bestCell.hour, 0, 0, 0);
    const dayDiff = (bestCell.day - target.getUTCDay() + 7) % 7;
    target.setUTCDate(target.getUTCDate() + dayDiff);
    if (target.getTime() <= now) target.setUTCDate(target.getUTCDate() + 7);
    if (Math.abs(target.getTime() - at.getTime()) < 3_600_000) continue;

    moves.push({
      postId: s.postId,
      fromIso: at.toISOString(),
      toIso: target.toISOString(),
      reason: `That slot scores ${bestCell.score}/100 for this account against ${currentScore}/100 now.`,
      expectedLift: Math.min(60, Math.round(((bestCell.score - currentScore) / Math.max(1, currentScore)) * 100)),
    });
    if (moves.length >= 8) break;
  }

  return {
    moves,
    warnings,
    summary: `${moves.length} reschedule suggestion(s) and ${warnings.length} warning(s) across ${scheduled.length} queued post(s).`,
  };
}

function scoreOf(
  bestTimes: QueueInput["bestTimes"],
  accountIds: string[],
  day: number,
  hour: number,
): number {
  const hits = bestTimes.filter(
    (b) => accountIds.includes(b.accountId) && b.dayOfWeek === day && b.hour === hour,
  );
  if (hits.length === 0) return 30; // unknown slot - assume mediocre
  return Math.round(hits.reduce((s, h) => s + h.score, 0) / hits.length);
}
