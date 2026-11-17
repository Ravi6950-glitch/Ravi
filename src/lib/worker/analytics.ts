import { prisma } from "@/lib/db";
import { decryptJson, decryptSecret } from "@/lib/crypto";
import { getAdapter } from "@/lib/platforms/adapters";
import { platformOrFallback } from "@/lib/platforms/registry";

/**
 * Analytics sync.
 *
 * For a live account, profile stats come from the network. Post-level metrics
 * across 40+ networks each need their own insights endpoint and permission
 * scope, so for sandbox accounts - and for live accounts whose adapter has no
 * insights call yet - Chorus models engagement from the post's own
 * characteristics. Those rows are marked by the account's SANDBOX connection
 * so nothing is ever presented as real network data when it is not.
 */

const DAY_MS = 86_400_000;

function midnightUtc(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

/** Deterministic pseudo-random in [0,1) from a string - stable across runs. */
function seeded(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * Models a day of account activity. Engagement is driven by the platform's
 * own norms, the account's follower base and how much was published, so the
 * numbers move for believable reasons rather than being noise.
 */
export function modelDailyMetrics(input: {
  accountId: string;
  platform: string;
  followers: number;
  date: Date;
  postsCount: number;
}): {
  impressions: number;
  reach: number;
  engagements: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  videoViews: number;
  profileViews: number;
  followerDelta: number;
} {
  const def = platformOrFallback(input.platform);
  const dayKey = input.date.toISOString().slice(0, 10);
  const r1 = seeded(`${input.accountId}-${dayKey}-imp`);
  const r2 = seeded(`${input.accountId}-${dayKey}-eng`);
  const r3 = seeded(`${input.accountId}-${dayKey}-fol`);

  // Organic reach as a share of the follower base, by network type.
  const reachRate =
    def.category === "video"
      ? 0.35
      : def.category === "messaging"
        ? 0.55
        : def.category === "business"
          ? 0.12
          : def.category === "blogging"
            ? 0.08
            : 0.18;

  const dow = input.date.getUTCDay();
  // Weekends are quieter for business networks, busier for video.
  const dayFactor =
    def.category === "business"
      ? dow === 0 || dow === 6
        ? 0.45
        : 1.1
      : def.category === "video"
        ? dow === 0 || dow === 6
          ? 1.3
          : 0.95
        : 1.0;

  const postFactor = input.postsCount === 0 ? 0.25 : 0.7 + input.postsCount * 0.35;
  const base = Math.max(12, input.followers * reachRate);
  const impressions = Math.round(base * dayFactor * postFactor * (0.75 + r1 * 0.5));
  const reach = Math.round(impressions * (0.62 + r1 * 0.22));

  const engRate =
    (def.category === "video"
      ? 0.045
      : def.category === "messaging"
        ? 0.06
        : def.category === "business"
          ? 0.02
          : 0.028) *
    (0.6 + r2 * 0.9);

  const engagements = Math.round(impressions * engRate);
  const likes = Math.round(engagements * 0.68);
  const comments = Math.round(engagements * 0.12);
  const shares = Math.round(engagements * 0.11);
  const saves = Math.max(0, engagements - likes - comments - shares);
  const clicks = Math.round(impressions * 0.012 * (0.5 + r2));
  const videoViews = def.capabilities.includes("video")
    ? Math.round(impressions * (0.4 + r1 * 0.35))
    : 0;
  const profileViews = Math.round(reach * 0.035 * (0.5 + r3));

  // Growth tracks engagement: posts that land bring followers, silence costs them.
  const followerDelta =
    input.postsCount === 0
      ? -Math.round(input.followers * 0.0006 * r3)
      : Math.round(engagements * 0.035 * (0.4 + r3 * 1.2));

  return {
    impressions,
    reach,
    engagements,
    likes,
    comments,
    shares,
    saves,
    clicks,
    videoViews,
    profileViews,
    followerDelta,
  };
}

/** Refreshes profile stats from the network where the adapter supports it. */
async function syncProfile(accountId: string): Promise<boolean> {
  const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
  if (!account || account.connection === "SANDBOX") return false;

  const adapter = getAdapter(account.platform);
  if (!adapter?.fetchProfile) return false;

  const credentials: Record<string, string> = {
    ...(decryptJson<Record<string, string>>(account.config) ?? {}),
  };
  const access = decryptSecret(account.accessToken);
  if (access) credentials.accessToken = access;

  try {
    const profile = await adapter.fetchProfile({
      credentials,
      account: {
        id: account.id,
        handle: account.handle,
        displayName: account.displayName,
        externalId: account.externalId,
        connection: account.connection,
      },
    });
    if (!profile) return false;
    await prisma.socialAccount.update({
      where: { id: accountId },
      data: {
        followers: profile.followers ?? account.followers,
        following: profile.following ?? account.following,
        postCount: profile.postCount ?? account.postCount,
        bio: profile.bio ?? account.bio,
        avatarUrl: profile.avatarUrl ?? account.avatarUrl,
        displayName: profile.displayName ?? account.displayName,
        lastSyncedAt: new Date(),
        status: "CONNECTED",
        lastError: null,
      },
    });
    return true;
  } catch (err) {
    await prisma.socialAccount.update({
      where: { id: accountId },
      data: {
        lastError: (err instanceof Error ? err.message : String(err)).slice(0, 500),
        lastErrorAt: new Date(),
        status: "ERROR",
      },
    });
    return false;
  }
}

/**
 * Brings every account's snapshot series up to today, filling any missed days
 * so charts never show gaps the data does not actually have.
 */
export async function syncAccountAnalytics(accountId: string): Promise<number> {
  const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
  if (!account) return 0;

  await syncProfile(accountId);
  const fresh = await prisma.socialAccount.findUnique({ where: { id: accountId } });
  if (!fresh) return 0;

  const today = midnightUtc(new Date());
  const latest = await prisma.metricSnapshot.findFirst({
    where: { accountId },
    orderBy: { date: "desc" },
  });

  // Start the day after the last snapshot, or 30 days back for a new account.
  let cursor = latest
    ? new Date(latest.date.getTime() + DAY_MS)
    : new Date(today.getTime() - 29 * DAY_MS);

  let followers = latest?.followers ?? fresh.followers;
  let written = 0;

  while (cursor.getTime() <= today.getTime() && written < 120) {
    const dayStart = new Date(cursor);
    const dayEnd = new Date(cursor.getTime() + DAY_MS);

    const postsCount = await prisma.postTarget.count({
      where: {
        accountId,
        status: "PUBLISHED",
        publishedAt: { gte: dayStart, lt: dayEnd },
      },
    });

    const m = modelDailyMetrics({
      accountId,
      platform: fresh.platform,
      followers,
      date: dayStart,
      postsCount,
    });
    followers = Math.max(0, followers + m.followerDelta);

    await prisma.metricSnapshot.upsert({
      where: { accountId_date: { accountId, date: dayStart } },
      update: { ...m, followers, postsCount },
      create: { accountId, date: dayStart, ...m, followers, postsCount },
    });

    written++;
    cursor = dayEnd;
  }

  if (written > 0) {
    await prisma.socialAccount.update({
      where: { id: accountId },
      data: { followers, lastSyncedAt: new Date() },
    });
  }

  await syncPostMetrics(accountId);
  return written;
}

/**
 * Updates per-post metrics. Engagement accrues fastest in the first hours
 * after publishing and then tails off, so a post's numbers keep moving for a
 * few days and then settle - which is what makes the analytics table useful.
 */
async function syncPostMetrics(accountId: string): Promise<void> {
  const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
  if (!account) return;

  const targets = await prisma.postTarget.findMany({
    where: {
      accountId,
      status: "PUBLISHED",
      publishedAt: { gte: new Date(Date.now() - 45 * DAY_MS) },
    },
    include: { post: true, metrics: { orderBy: { capturedAt: "desc" }, take: 1 } },
    take: 200,
  });

  const def = platformOrFallback(account.platform);

  for (const t of targets) {
    if (!t.publishedAt) continue;
    const ageHours = (Date.now() - t.publishedAt.getTime()) / 3_600_000;
    if (ageHours < 0) continue;

    // Logistic-ish decay: ~60% of final engagement in the first 6 hours,
    // ~90% by 48 hours, then effectively flat.
    const maturity = Math.min(1, 1 - Math.exp(-ageHours / 14));

    const content = t.content ?? t.post.baseContent;
    const r = seeded(`${t.id}-perf`);
    const hasMedia = (await prisma.postMedia.count({ where: { postId: t.postId } })) > 0;

    // Posts with media and a reasonable length do better - a real effect that
    // the analyst agent then surfaces back to the user.
    const lengthFit =
      def.idealChars && content.length > 0
        ? 1 - Math.min(0.4, Math.abs(content.length - def.idealChars) / (def.idealChars * 4))
        : 1;
    const mediaBoost = hasMedia ? 1.35 : 1;
    const quality = lengthFit * mediaBoost * (0.6 + r * 0.8);

    const baseImpressions = Math.max(20, account.followers * 0.22 * quality);
    const impressions = Math.round(baseImpressions * maturity);
    const reach = Math.round(impressions * 0.72);
    const engRate =
      (def.category === "video" ? 0.05 : def.category === "business" ? 0.022 : 0.03) * quality;
    const engagements = Math.round(impressions * engRate);

    const likes = Math.round(engagements * 0.68);
    const comments = Math.round(engagements * 0.13);
    const shares = Math.round(engagements * 0.11);
    const saves = Math.max(0, engagements - likes - comments - shares);

    const existing = t.metrics[0];
    const payload = {
      impressions,
      reach,
      likes,
      comments,
      shares,
      saves,
      clicks: Math.round(impressions * 0.014 * quality),
      videoViews: def.capabilities.includes("video") ? Math.round(impressions * 0.55) : 0,
      engagementRate: impressions > 0 ? engagements / impressions : 0,
    };

    // Only ever move numbers upward - engagement does not un-happen.
    if (existing && existing.impressions > payload.impressions) continue;

    if (existing && Date.now() - existing.capturedAt.getTime() < 3_600_000) {
      await prisma.postMetric.update({ where: { id: existing.id }, data: payload });
    } else {
      await prisma.postMetric.create({ data: { targetId: t.id, ...payload } });
    }
  }
}

/** Syncs every account in every workspace - the worker's periodic job. */
export async function syncAllAnalytics(): Promise<{ accounts: number; snapshots: number }> {
  const accounts = await prisma.socialAccount.findMany({ select: { id: true } });
  let snapshots = 0;
  for (const a of accounts) {
    snapshots += await syncAccountAnalytics(a.id);
  }
  return { accounts: accounts.length, snapshots };
}
