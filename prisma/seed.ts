/**
 * Seeds a working demo workspace.
 *
 * Everything here is generated deterministically so the dashboard, analytics
 * and agents all have real history to work with on first run - no empty
 * charts, no "come back tomorrow".
 *
 * Run with: npm run db:seed
 */

import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const prisma = new PrismaClient();

const DAY_MS = 86_400_000;
const DEMO_EMAIL = "demo@chorus.app";
const DEMO_PASSWORD = "chorus-demo-2026";

// ---------------------------------------------------------------------------
// Local copies of the hashing / encryption format, so the seed has no
// dependency on the app's module resolution.
// ---------------------------------------------------------------------------

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return [
    "scrypt",
    "16384",
    "8",
    "1",
    salt.toString("base64url"),
    hash.toString("base64url"),
  ].join("~");
}

/** Deterministic pseudo-random in [0,1) - same shape as the analytics model. */
function seeded(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function midnightUtc(d: Date): Date {
  const c = new Date(d);
  c.setUTCHours(0, 0, 0, 0);
  return c;
}

// ---------------------------------------------------------------------------
// Demo content
// ---------------------------------------------------------------------------

const ACCOUNTS: Array<{
  platform: string;
  handle: string;
  displayName: string;
  followers: number;
  bio: string | null;
  avatar: boolean;
}> = [
  {
    platform: "instagram",
    handle: "northwind.studio",
    displayName: "Northwind Studio",
    followers: 18_420,
    bio: "Design tools for people who ship. Made in Lisbon.",
    avatar: true,
  },
  {
    platform: "x",
    handle: "northwindhq",
    displayName: "Northwind",
    followers: 9_180,
    bio: "We build Northwind. Mostly posting about the hard parts.",
    avatar: true,
  },
  {
    platform: "linkedin",
    handle: "northwind-studio",
    displayName: "Northwind Studio",
    followers: 4_760,
    bio: "Design tooling for product teams.",
    avatar: true,
  },
  {
    platform: "tiktok",
    handle: "northwind",
    displayName: "Northwind",
    followers: 31_900,
    bio: "60-second design teardowns.",
    avatar: true,
  },
  {
    platform: "youtube",
    handle: "northwindstudio",
    displayName: "Northwind Studio",
    followers: 12_300,
    bio: "Long-form build logs and teardowns.",
    avatar: true,
  },
  {
    platform: "mastodon",
    handle: "northwind",
    displayName: "Northwind",
    followers: 2_140,
    // Deliberately left empty so the Profile Auditor has a real issue to find.
    bio: null,
    avatar: true,
  },
  {
    platform: "bluesky",
    handle: "northwind.bsky.social",
    displayName: "Northwind",
    followers: 3_480,
    bio: "Design tools. Build logs. Occasional strong opinions.",
    avatar: true,
  },
  {
    platform: "threads",
    handle: "northwind.studio",
    displayName: "Northwind Studio",
    followers: 6_050,
    bio: "Shorter thoughts from the Northwind team.",
    avatar: false, // another real issue for the auditor
  },
  {
    platform: "pinterest",
    handle: "northwindstudio",
    displayName: "Northwind Studio",
    followers: 7_720,
    bio: "Interface inspiration, organised properly.",
    avatar: true,
  },
  {
    platform: "reddit",
    handle: "northwind_team",
    displayName: "Northwind team",
    followers: 890,
    bio: "We answer questions about Northwind here.",
    avatar: true,
  },
  {
    platform: "discord",
    handle: "northwind-community",
    displayName: "Northwind Community",
    followers: 5_300,
    bio: "Where our users actually talk to each other.",
    avatar: true,
  },
  {
    platform: "telegram",
    handle: "northwindchangelog",
    displayName: "Northwind Changelog",
    followers: 2_960,
    bio: "Every release, as it ships.",
    avatar: true,
  },
];

const PUBLISHED_POSTS: Array<{ content: string; platforms: string[]; daysAgo: number }> = [
  {
    content:
      "Offline mode shipped today.\n\nFour months, and almost all of it went on conflict resolution. Two people editing the same frame on two planes is the easy case. The hard case is one of them undoing work the other built on.\n\nHere is what we landed on and why.",
    platforms: ["x", "linkedin", "mastodon", "bluesky", "telegram"],
    daysAgo: 2,
  },
  {
    content:
      "We deleted 40% of our settings screen this week.\n\nEvery toggle we removed had a reason to exist when it was added. None of them had a reason to exist today. Nobody has complained.\n\nAudit your own settings page. You will find the same thing.",
    platforms: ["x", "linkedin", "threads", "bluesky"],
    daysAgo: 4,
  },
  {
    content:
      "A thing that took us too long to learn: the first frame of your onboarding video matters more than the rest of it combined.\n\nMost people decide in under two seconds. We rebuilt ours to put the finished result first, then show the steps. Completion went from 22% to 61%.",
    platforms: ["instagram", "tiktok", "youtube", "linkedin"],
    daysAgo: 6,
  },
  {
    content:
      "Three interface patterns that quietly cost you users:\n\n1. A loading spinner with no sense of progress\n2. Destructive actions with the same weight as safe ones\n3. Error messages that describe the error but not the fix\n\nAll three are cheap to fix. All three are everywhere.",
    platforms: ["instagram", "pinterest", "linkedin", "x"],
    daysAgo: 9,
  },
  {
    content:
      "Our build went from 94 seconds to 11. The fix was not clever: we were type-checking the same files on every package build because of a path alias nobody had revisited in two years.\n\nBefore you optimise, measure where the time actually goes.",
    platforms: ["x", "mastodon", "bluesky", "reddit", "telegram"],
    daysAgo: 12,
  },
  {
    content:
      "The honest version of our roadmap: we are not building the integrations people keep asking for until search works properly.\n\nShipping more surface area on a weak core just gives people more places to be disappointed.",
    platforms: ["linkedin", "x", "threads"],
    daysAgo: 16,
  },
  {
    content:
      "60-second teardown: why the new checkout flow on a well-known retailer loses people at step three. It is not the form length. It is that the total changes after you commit.",
    platforms: ["tiktok", "youtube", "instagram"],
    daysAgo: 19,
  },
  {
    content:
      "We now run every release past a 2G connection and a six-year-old Android phone before it ships. It caught three things last month that nobody on the team would ever have hit.",
    platforms: ["x", "mastodon", "linkedin", "discord"],
    daysAgo: 23,
  },
  {
    content:
      "Changelog: faster canvas rendering on large files, keyboard shortcuts for layer reordering, and a fix for the bug where comments attached to the wrong frame after an undo. Details in the thread.",
    platforms: ["telegram", "discord", "x", "bluesky"],
    daysAgo: 26,
  },
];

const SCHEDULED_POSTS: Array<{
  content: string;
  platforms: string[];
  inDays: number;
  hour: number;
  status: "SCHEDULED" | "QUEUED" | "NEEDS_APPROVAL";
}> = [
  {
    content:
      "Next week we are publishing everything we learned building offline mode, including the two approaches we abandoned. If there is a specific part you want covered, say so and we will make sure it is in there.",
    platforms: ["x", "linkedin", "bluesky"],
    inDays: 1,
    hour: 9,
    status: "SCHEDULED",
  },
  {
    content:
      "New teardown going up tomorrow: the three-second rule in app onboarding, and the four apps that get it right.",
    platforms: ["instagram", "tiktok"],
    inDays: 1,
    hour: 17,
    status: "QUEUED",
  },
  {
    content:
      "Hiring: a design engineer who cares about the 200ms nobody notices. Remote within European timezones. Full details on the site.",
    platforms: ["linkedin", "x", "mastodon"],
    inDays: 2,
    hour: 8,
    status: "SCHEDULED",
  },
  {
    content:
      "Poll for the community: what should we take on after search - better version history, or real-time cursors? Both are roughly a quarter of work.",
    platforms: ["discord", "telegram", "x"],
    inDays: 3,
    hour: 13,
    status: "QUEUED",
  },
  {
    content:
      "Draft for review: our take on why design systems fail in their second year. Needs a second pair of eyes before this goes out - it is more opinionated than usual.",
    platforms: ["linkedin", "threads"],
    inDays: 4,
    hour: 11,
    status: "NEEDS_APPROVAL",
  },
  {
    content:
      "Changelog: keyboard-first layer navigation, 40% faster file open on large documents, and the comment-threading fix several of you asked for.",
    platforms: ["telegram", "discord", "bluesky", "mastodon"],
    inDays: 5,
    hour: 10,
    status: "SCHEDULED",
  },
  {
    content:
      "Saving this one for the end of the month: a full write-up of our accessibility audit, including everything we failed.",
    platforms: ["linkedin", "x"],
    inDays: 9,
    hour: 9,
    status: "QUEUED",
  },
];

const DRAFTS = [
  {
    content:
      "Something we keep coming back to: most tools optimise for the demo, not the hundredth hour. What does your product feel like on day 100?",
    platforms: ["x", "linkedin"],
  },
  {
    content:
      "Rough notes for a longer piece on why we stopped doing weekly releases and moved to shipping when it is ready. Not sure this one is right yet.",
    platforms: ["linkedin"],
  },
];

// Served from /public, so the demo library works with no network at all.
const MEDIA = [
  {
    url: "/media/gradient-indigo.svg",
    alt: "Indigo-to-magenta gradient card reading 'Offline mode shipped'",
    kind: "image",
  },
  {
    url: "/media/gradient-teal.svg",
    alt: "Teal-to-blue gradient card reading 'Build log, episode 12'",
    kind: "image",
  },
  {
    url: "/media/gradient-amber.svg",
    alt: "Amber-to-rose gradient card reading 'Teardown: checkout flows'",
    kind: "image",
  },
  {
    url: "/media/gradient-violet.svg",
    alt: "Violet gradient card reading 'Changelog, this week'",
    kind: "image",
  },
];

// ---------------------------------------------------------------------------

async function main() {
  console.log("Seeding Chorus demo data…\n");

  // Start from a clean demo workspace so re-seeding is idempotent.
  const existing = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    include: { memberships: true },
  });
  if (existing) {
    for (const m of existing.memberships) {
      await prisma.workspace.delete({ where: { id: m.workspaceId } }).catch(() => {});
    }
    await prisma.user.delete({ where: { id: existing.id } }).catch(() => {});
    console.log("  Removed the previous demo workspace.");
  }

  // --- People -----------------------------------------------------------
  const owner = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: "Ravi Kumar",
      passwordHash: hashPassword(DEMO_PASSWORD),
      jobTitle: "Head of social",
      timezone: "Asia/Kolkata",
      avatarColor: "#6366f1",
      lastLoginAt: new Date(),
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: "Northwind Studio",
      slug: "northwind-studio",
      brandVoice:
        "Direct and practical. We explain the trade-off rather than pretending there isn't one. Specific numbers over adjectives. No hype, no exclamation marks, no emoji.",
      timezone: "Asia/Kolkata",
      weekStart: 1,
      plan: "studio",
      memberships: { create: { userId: owner.id, role: "OWNER" } },
    },
  });
  console.log(`  Workspace: ${workspace.name}`);

  const teammates = [
    { name: "Priya Sharma", email: "priya@chorus.app", role: "ADMIN", title: "Content lead", color: "#ec4899" },
    { name: "Daniel Okafor", email: "daniel@chorus.app", role: "EDITOR", title: "Social editor", color: "#22c55e" },
    { name: "Mei Tanaka", email: "mei@chorus.app", role: "CONTRIBUTOR", title: "Designer", color: "#f59e0b" },
    { name: "Tom Becker", email: "tom@chorus.app", role: "VIEWER", title: "Founder", color: "#0ea5e9" },
  ];
  const members = [owner];
  for (const t of teammates) {
    await prisma.user.deleteMany({ where: { email: t.email } });
    const u = await prisma.user.create({
      data: {
        email: t.email,
        name: t.name,
        passwordHash: hashPassword(DEMO_PASSWORD),
        jobTitle: t.title,
        avatarColor: t.color,
        timezone: "Europe/London",
        lastLoginAt: new Date(Date.now() - Math.random() * 5 * DAY_MS),
        memberships: { create: { workspaceId: workspace.id, role: t.role } },
      },
    });
    members.push(u);
  }
  console.log(`  Team: ${members.length} members`);

  // --- Posting schedule -------------------------------------------------
  const slotPlan: Array<[number, number, number]> = [
    [1, 9, 0], [1, 13, 30], [1, 17, 0],
    [2, 8, 0], [2, 12, 0], [2, 18, 0],
    [3, 9, 0], [3, 15, 0],
    [4, 8, 0], [4, 13, 30], [4, 19, 0],
    [5, 10, 0], [5, 16, 0],
    [6, 11, 0],
    [0, 19, 0],
  ];
  await prisma.queueSlot.createMany({
    data: slotPlan.map(([dayOfWeek, hour, minute]) => ({
      workspaceId: workspace.id,
      dayOfWeek,
      hour,
      minute,
    })),
  });
  console.log(`  Posting schedule: ${slotPlan.length} slots a week`);

  // --- Connected accounts ----------------------------------------------
  const accountIds = new Map<string, string>();
  for (const a of ACCOUNTS) {
    const account = await prisma.socialAccount.create({
      data: {
        workspaceId: workspace.id,
        platform: a.platform,
        handle: a.handle,
        displayName: a.displayName,
        bio: a.bio,
        // A local path, so nothing in the demo depends on an outside service.
        avatarUrl: a.avatar ? `/media/gradient-indigo.svg` : null,
        status: "CONNECTED",
        connection: "SANDBOX",
        followers: a.followers,
        following: Math.round(a.followers * (0.04 + seeded(a.handle) * 0.1)),
        lastSyncedAt: new Date(),
      },
    });
    accountIds.set(a.platform, account.id);
  }
  console.log(`  Connected ${ACCOUNTS.length} accounts (sandbox mode)`);

  // --- Media ------------------------------------------------------------
  const mediaIds: string[] = [];
  for (const m of MEDIA) {
    const asset = await prisma.mediaAsset.create({
      data: { workspaceId: workspace.id, url: m.url, alt: m.alt, kind: m.kind },
    });
    mediaIds.push(asset.id);
  }

  // --- Campaign ---------------------------------------------------------
  const campaign = await prisma.campaign.create({
    data: {
      workspaceId: workspace.id,
      name: "Offline mode launch",
      color: "#8b5cf6",
      goal: "Drive 500 trial starts from the offline-mode announcement",
      startsAt: new Date(Date.now() - 20 * DAY_MS),
      endsAt: new Date(Date.now() + 10 * DAY_MS),
    },
  });

  // --- Published posts, with per-post metrics --------------------------
  let publishedCount = 0;
  let targetCount = 0;

  for (const [i, p] of PUBLISHED_POSTS.entries()) {
    const publishedAt = new Date(Date.now() - p.daysAgo * DAY_MS + (i % 5) * 3_600_000);
    const author = members[i % 3]; // owner, Priya, Daniel

    const post = await prisma.post.create({
      data: {
        workspaceId: workspace.id,
        authorId: author.id,
        campaignId: p.daysAgo <= 12 ? campaign.id : null,
        baseContent: p.content,
        status: "PUBLISHED",
        publishedAt,
        scheduledAt: publishedAt,
        aiGenerated: i % 3 === 0,
        aiAgent: i % 3 === 0 ? "composer" : null,
        tags: JSON.stringify([]),
        media:
          i % 3 === 0
            ? { create: [{ mediaId: mediaIds[i % mediaIds.length], position: 0 }] }
            : undefined,
      },
    });
    publishedCount++;

    for (const platform of p.platforms) {
      const accountId = accountIds.get(platform);
      if (!accountId) continue;
      const account = ACCOUNTS.find((a) => a.platform === platform)!;

      const target = await prisma.postTarget.create({
        data: {
          postId: post.id,
          accountId,
          status: "PUBLISHED",
          publishedAt,
          attempts: 1,
          externalPostId: `sbx_${post.id.slice(-6)}_${platform}`,
          externalUrl: `https://sandbox.chorus.local/${platform}/${account.handle}/${post.id.slice(-8)}`,
        },
      });
      targetCount++;

      // Performance driven by the post itself: shorter copy and media do
      // better, so the analyst agent has real patterns to find.
      const r = seeded(`${target.id}-perf`);
      const hasMedia = i % 3 === 0;
      const lengthFactor = p.content.length < 300 ? 1.25 : p.content.length < 600 ? 1.0 : 0.82;
      const quality = lengthFactor * (hasMedia ? 1.3 : 1) * (0.65 + r * 0.7);

      const impressions = Math.round(account.followers * 0.26 * quality);
      const engRate = 0.028 * quality;
      const engagements = Math.round(impressions * engRate);
      const likes = Math.round(engagements * 0.68);
      const comments = Math.round(engagements * 0.13);
      const shares = Math.round(engagements * 0.11);

      await prisma.postMetric.create({
        data: {
          targetId: target.id,
          capturedAt: new Date(publishedAt.getTime() + 2 * DAY_MS),
          impressions,
          reach: Math.round(impressions * 0.73),
          likes,
          comments,
          shares,
          saves: Math.max(0, engagements - likes - comments - shares),
          clicks: Math.round(impressions * 0.015 * quality),
          videoViews: ["tiktok", "youtube", "instagram"].includes(platform)
            ? Math.round(impressions * 0.58)
            : 0,
          engagementRate: impressions > 0 ? engagements / impressions : 0,
        },
      });
    }
  }
  console.log(`  Published history: ${publishedCount} posts across ${targetCount} destinations`);

  // One post that partly failed, so the queue's failure path is visible.
  const partial = await prisma.post.create({
    data: {
      workspaceId: workspace.id,
      authorId: members[1].id,
      baseContent:
        "Quick heads-up: scheduled maintenance this Sunday 02:00-04:00 UTC. Editing will be read-only for about twenty minutes inside that window.",
      status: "PARTIAL",
      publishedAt: new Date(Date.now() - 1 * DAY_MS),
      scheduledAt: new Date(Date.now() - 1 * DAY_MS),
      tags: JSON.stringify([]),
    },
  });
  for (const [platform, ok] of [
    ["telegram", true],
    ["discord", true],
    ["x", false],
  ] as const) {
    const accountId = accountIds.get(platform);
    if (!accountId) continue;
    await prisma.postTarget.create({
      data: {
        postId: partial.id,
        accountId,
        status: ok ? "PUBLISHED" : "FAILED",
        publishedAt: ok ? new Date(Date.now() - 1 * DAY_MS) : null,
        attempts: ok ? 1 : 3,
        error: ok
          ? null
          : "HTTP 429: rate limit exceeded for this app. The free API tier allows 17 posts per 24 hours.",
        externalPostId: ok ? `sbx_${partial.id.slice(-6)}_${platform}` : null,
      },
    });
  }

  // --- Scheduled and queued --------------------------------------------
  for (const [i, p] of SCHEDULED_POSTS.entries()) {
    const when = new Date(Date.now() + p.inDays * DAY_MS);
    when.setUTCHours(p.hour, i % 2 === 0 ? 0 : 30, 0, 0);

    const post = await prisma.post.create({
      data: {
        workspaceId: workspace.id,
        authorId: members[(i + 1) % 4].id,
        campaignId: p.inDays <= 3 ? campaign.id : null,
        baseContent: p.content,
        status: p.status,
        scheduledAt: when,
        useNextSlot: p.status === "QUEUED",
        aiGenerated: i % 4 === 0,
        tags: JSON.stringify([]),
        media:
          i % 3 === 1
            ? { create: [{ mediaId: mediaIds[i % mediaIds.length], position: 0 }] }
            : undefined,
      },
    });
    for (const platform of p.platforms) {
      const accountId = accountIds.get(platform);
      if (!accountId) continue;
      await prisma.postTarget.create({
        data: { postId: post.id, accountId, status: "PENDING" },
      });
    }
  }
  console.log(`  Queue: ${SCHEDULED_POSTS.length} upcoming posts`);

  // --- Drafts -----------------------------------------------------------
  for (const [i, d] of DRAFTS.entries()) {
    const post = await prisma.post.create({
      data: {
        workspaceId: workspace.id,
        authorId: members[3].id,
        baseContent: d.content,
        status: "DRAFT",
        tags: JSON.stringify([]),
      },
    });
    for (const platform of d.platforms) {
      const accountId = accountIds.get(platform);
      if (!accountId) continue;
      await prisma.postTarget.create({
        data: { postId: post.id, accountId, status: "PENDING" },
      });
    }
  }

  // --- 60 days of daily snapshots per account ---------------------------
  const today = midnightUtc(new Date());
  let snapshotCount = 0;

  for (const a of ACCOUNTS) {
    const accountId = accountIds.get(a.platform)!;
    // Work backwards from today's follower count so the series ends where the
    // account actually is.
    const days = 60;
    const growthTotal = Math.round(a.followers * (0.04 + seeded(a.handle) * 0.08));
    let followers = a.followers - growthTotal;

    const category = categoryOf(a.platform);
    const reachRate =
      category === "video" ? 0.35 : category === "messaging" ? 0.55 : category === "business" ? 0.12 : 0.18;
    const engBase =
      category === "video" ? 0.045 : category === "messaging" ? 0.06 : category === "business" ? 0.02 : 0.028;

    for (let d = days - 1; d >= 0; d--) {
      const date = new Date(today.getTime() - d * DAY_MS);
      const key = `${a.handle}-${date.toISOString().slice(0, 10)}`;
      const r1 = seeded(`${key}-i`);
      const r2 = seeded(`${key}-e`);
      const r3 = seeded(`${key}-f`);

      const postsCount = await prisma.postTarget.count({
        where: {
          accountId,
          status: "PUBLISHED",
          publishedAt: { gte: date, lt: new Date(date.getTime() + DAY_MS) },
        },
      });

      const dow = date.getUTCDay();
      const dayFactor =
        category === "business"
          ? dow === 0 || dow === 6
            ? 0.45
            : 1.1
          : category === "video"
            ? dow === 0 || dow === 6
              ? 1.3
              : 0.95
            : 1;
      // A gentle upward trend over the window, so the charts have a shape.
      const trend = 0.82 + ((days - d) / days) * 0.36;
      const postFactor = postsCount === 0 ? 0.3 : 0.75 + postsCount * 0.3;

      const impressions = Math.round(
        Math.max(14, followers * reachRate) * dayFactor * trend * postFactor * (0.78 + r1 * 0.44),
      );
      const reach = Math.round(impressions * (0.63 + r1 * 0.2));
      const engagements = Math.round(impressions * engBase * (0.65 + r2 * 0.8));
      const likes = Math.round(engagements * 0.68);
      const comments = Math.round(engagements * 0.12);
      const shares = Math.round(engagements * 0.11);
      const followerDelta =
        postsCount === 0
          ? -Math.round(followers * 0.0005 * r3)
          : Math.round(engagements * 0.04 * (0.4 + r3 * 1.2));

      followers = Math.max(0, followers + followerDelta);

      await prisma.metricSnapshot.create({
        data: {
          accountId,
          date,
          followers,
          followerDelta,
          impressions,
          reach,
          engagements,
          likes,
          comments,
          shares,
          saves: Math.max(0, engagements - likes - comments - shares),
          clicks: Math.round(impressions * 0.013 * (0.5 + r2)),
          videoViews: ["tiktok", "youtube", "instagram"].includes(a.platform)
            ? Math.round(impressions * (0.45 + r1 * 0.3))
            : 0,
          profileViews: Math.round(reach * 0.034 * (0.5 + r3)),
          postsCount,
        },
      });
      snapshotCount++;
    }

    // Keep the account's headline number consistent with the final snapshot.
    await prisma.socialAccount.update({
      where: { id: accountId },
      data: { followers, postCount: await prisma.postTarget.count({ where: { accountId, status: "PUBLISHED" } }) },
    });
  }
  console.log(`  Analytics: ${snapshotCount} daily snapshots over 60 days`);

  // --- Best-time heatmap, derived from the published history ------------
  let bestTimeCount = 0;
  for (const a of ACCOUNTS) {
    const accountId = accountIds.get(a.platform)!;
    const targets = await prisma.postTarget.findMany({
      where: { accountId, status: "PUBLISHED" },
      include: { metrics: { orderBy: { capturedAt: "desc" }, take: 1 } },
    });

    const grid = new Map<string, { total: number; count: number }>();
    for (const t of targets) {
      if (!t.publishedAt) continue;
      const k = `${t.publishedAt.getUTCDay()}-${t.publishedAt.getUTCHours()}`;
      const c = grid.get(k) ?? { total: 0, count: 0 };
      c.total += t.metrics[0]?.engagementRate ?? 0;
      c.count += 1;
      grid.set(k, c);
    }

    // Plus a plausible baseline for this kind of network, so the heatmap is
    // readable rather than three lonely cells.
    const baseline = baselineSlots(categoryOf(a.platform));
    for (const b of baseline) {
      const k = `${b.dayOfWeek}-${b.hour}`;
      if (grid.has(k)) continue;
      grid.set(k, { total: (b.score / 900) * 1, count: 1 });
    }

    for (const [k, v] of grid) {
      const [dayOfWeek, hour] = k.split("-").map(Number);
      const avg = v.total / v.count;
      await prisma.bestTime.upsert({
        where: { accountId_dayOfWeek_hour: { accountId, dayOfWeek, hour } },
        update: { score: Math.min(100, Math.round(avg * 900 + v.count * 4)), sampleSize: v.count },
        create: {
          accountId,
          dayOfWeek,
          hour,
          score: Math.min(100, Math.round(avg * 900 + v.count * 4)),
          sampleSize: v.count,
        },
      });
      bestTimeCount++;
    }
  }
  console.log(`  Timing heatmap: ${bestTimeCount} slots scored`);

  // --- Automation rules -------------------------------------------------
  const automations = [
    { agent: "performance-analyst", name: "Daily performance review", intervalMinutes: 720 },
    { agent: "profile-auditor", name: "Profile health audit", intervalMinutes: 1440 },
    { agent: "timing-oracle", name: "Best-time recalculation", intervalMinutes: 360 },
    { agent: "queue-optimizer", name: "Queue optimisation", intervalMinutes: 480 },
    { agent: "trend-scout", name: "Trend and idea scouting", intervalMinutes: 720 },
  ];
  for (const [i, a] of automations.entries()) {
    await prisma.automationRule.create({
      data: {
        workspaceId: workspace.id,
        agent: a.agent,
        name: a.name,
        enabled: true,
        intervalMinutes: a.intervalMinutes,
        // Stagger the first runs so the worker is not swamped on boot.
        nextRunAt: new Date(Date.now() + 45_000 + i * 40_000),
      },
    });
  }
  console.log(`  Automation: ${automations.length} agents scheduled`);

  // --- Activity log -----------------------------------------------------
  const activity = [
    { action: "workspace.created", detail: "Northwind Studio", userId: owner.id, daysAgo: 58 },
    { action: "account.connected", detail: "Instagram @northwind.studio", userId: owner.id, daysAgo: 57 },
    { action: "account.connected", detail: "X @northwindhq", userId: owner.id, daysAgo: 57 },
    { action: "member.added", detail: "priya@chorus.app as ADMIN", userId: owner.id, daysAgo: 50 },
    { action: "member.added", detail: "daniel@chorus.app as EDITOR", userId: members[1].id, daysAgo: 44 },
    { action: "post.published", detail: "Published to 5 destinations", userId: members[1].id, daysAgo: 12 },
    { action: "queue.slots_applied", detail: "14 AI-recommended slots", userId: owner.id, daysAgo: 8 },
    { action: "post.published", detail: "Published to 4 destinations", userId: members[2].id, daysAgo: 4 },
    { action: "post.partial", detail: "2 of 3 destinations succeeded", userId: members[1].id, daysAgo: 1 },
    { action: "post.published", detail: "Published to 5 destinations", userId: owner.id, daysAgo: 2 },
  ];
  for (const a of activity) {
    await prisma.activityLog.create({
      data: {
        workspaceId: workspace.id,
        userId: a.userId,
        action: a.action,
        detail: a.detail,
        createdAt: new Date(Date.now() - a.daysAgo * DAY_MS),
      },
    });
  }

  // --- A pending invite -------------------------------------------------
  await prisma.invite.create({
    data: {
      workspaceId: workspace.id,
      email: "newhire@chorus.app",
      role: "EDITOR",
      token: crypto.randomBytes(24).toString("base64url"),
      invitedById: owner.id,
      expiresAt: new Date(Date.now() + 12 * DAY_MS),
    },
  });

  console.log("\nDone.\n");
  console.log("  Sign in at http://localhost:3000/login");
  console.log(`    email:    ${DEMO_EMAIL}`);
  console.log(`    password: ${DEMO_PASSWORD}`);
  console.log(
    "\n  The agents have not run yet - the background worker starts them within a minute,",
  );
  console.log("  or press 'Run now' on any agent from the AI agents page.\n");
}

function categoryOf(platform: string): string {
  if (["tiktok", "youtube", "vimeo", "twitch", "rumble"].includes(platform)) return "video";
  if (["telegram", "whatsapp", "discord", "slack", "line"].includes(platform)) return "messaging";
  if (["linkedin", "google-business", "nextdoor"].includes(platform)) return "business";
  if (["medium", "ghost", "wordpress", "devto", "hashnode", "substack", "tumblr"].includes(platform))
    return "blogging";
  return "social";
}

function baselineSlots(category: string): Array<{ dayOfWeek: number; hour: number; score: number }> {
  switch (category) {
    case "business":
      return [
        { dayOfWeek: 2, hour: 8, score: 74 },
        { dayOfWeek: 3, hour: 12, score: 70 },
        { dayOfWeek: 4, hour: 8, score: 68 },
        { dayOfWeek: 2, hour: 17, score: 62 },
        { dayOfWeek: 1, hour: 9, score: 58 },
      ];
    case "video":
      return [
        { dayOfWeek: 5, hour: 19, score: 76 },
        { dayOfWeek: 6, hour: 11, score: 72 },
        { dayOfWeek: 0, hour: 20, score: 70 },
        { dayOfWeek: 3, hour: 21, score: 64 },
        { dayOfWeek: 4, hour: 18, score: 60 },
      ];
    case "messaging":
      return [
        { dayOfWeek: 1, hour: 10, score: 72 },
        { dayOfWeek: 3, hour: 10, score: 70 },
        { dayOfWeek: 5, hour: 16, score: 66 },
        { dayOfWeek: 2, hour: 14, score: 60 },
      ];
    default:
      return [
        { dayOfWeek: 2, hour: 11, score: 72 },
        { dayOfWeek: 4, hour: 18, score: 70 },
        { dayOfWeek: 6, hour: 10, score: 66 },
        { dayOfWeek: 1, hour: 12, score: 62 },
        { dayOfWeek: 0, hour: 19, score: 56 },
      ];
  }
}

main()
  .catch((err) => {
    console.error("\nSeeding failed:\n", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
