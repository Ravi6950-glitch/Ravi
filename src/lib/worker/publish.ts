import { prisma } from "@/lib/db";
import { decryptJson, decryptSecret } from "@/lib/crypto";
import { platformOrFallback } from "@/lib/platforms/registry";
import { getAdapter, sandboxPublish } from "@/lib/platforms/adapters";
import type { PublishContext, PublishResult } from "@/lib/platforms/types";

/**
 * The publisher.
 *
 * Drains due posts one target at a time. A post with three targets where one
 * fails lands as PARTIAL rather than all-or-nothing, because the two that went
 * out are really out and the UI must say so.
 */

const MAX_ATTEMPTS = 3;

/** Reassembles the decrypted credential bag for an account. */
function credentialsFor(account: {
  accessToken: string | null;
  refreshToken: string | null;
  config: string | null;
}): Record<string, string> {
  const creds: Record<string, string> = {};
  const cfg = decryptJson<Record<string, string>>(account.config);
  if (cfg) Object.assign(creds, cfg);
  const access = decryptSecret(account.accessToken);
  if (access) creds.accessToken = access;
  const refresh = decryptSecret(account.refreshToken);
  if (refresh) creds.refreshToken = refresh;
  return creds;
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export interface PublishPostResult {
  postId: string;
  published: number;
  failed: number;
  status: string;
}

/** Publishes every pending target of one post. */
export async function publishPost(postId: string): Promise<PublishPostResult> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      targets: { include: { account: true } },
      media: { include: { media: true }, orderBy: { position: "asc" } },
    },
  });
  if (!post) return { postId, published: 0, failed: 0, status: "MISSING" };

  await prisma.post.update({
    where: { id: postId },
    data: { status: "PUBLISHING" },
  });

  const media = post.media.map((pm) => ({
    url: pm.media.url,
    kind: pm.media.kind,
    alt: pm.media.alt,
  }));

  let published = 0;
  let failed = 0;

  for (const target of post.targets) {
    if (target.status === "PUBLISHED") {
      published++;
      continue;
    }
    if (target.attempts >= MAX_ATTEMPTS) {
      failed++;
      continue;
    }

    const def = platformOrFallback(target.account.platform);
    const ctx: PublishContext = {
      platform: def,
      content: target.content ?? post.baseContent,
      threadParts: parseJson<string[]>(target.threadParts, []),
      media,
      options: parseJson<Record<string, string | boolean>>(target.options, {}),
      credentials: credentialsFor(target.account),
      account: {
        id: target.account.id,
        handle: target.account.handle,
        displayName: target.account.displayName,
        externalId: target.account.externalId,
        connection: target.account.connection,
      },
      link: post.link,
      firstComment: post.firstComment,
    };

    await prisma.postTarget.update({
      where: { id: target.id },
      data: { status: "PUBLISHING", attempts: { increment: 1 }, lastAttemptAt: new Date() },
    });

    let result: PublishResult;
    try {
      const adapter = getAdapter(target.account.platform);
      // Sandbox accounts always go through the simulator, even where a live
      // adapter exists - that is the whole point of sandbox mode.
      result =
        target.account.connection === "SANDBOX" || !adapter
          ? await sandboxPublish(ctx)
          : await adapter.publish(ctx);
    } catch (err) {
      result = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        retryable: true,
      };
    }

    if (result.ok) {
      published++;
      await prisma.postTarget.update({
        where: { id: target.id },
        data: {
          status: "PUBLISHED",
          externalPostId: result.externalPostId ?? null,
          externalUrl: result.externalUrl ?? null,
          publishedAt: new Date(),
          error: null,
        },
      });
      // Seed a metric row so the post shows up in analytics immediately with
      // zeros, rather than vanishing until the next sync.
      await prisma.postMetric.create({
        data: { targetId: target.id, impressions: 0, engagementRate: 0 },
      });
      await prisma.socialAccount.update({
        where: { id: target.accountId },
        data: { postCount: { increment: 1 }, lastError: null, lastErrorAt: null },
      });
    } else {
      failed++;
      const exhausted = target.attempts + 1 >= MAX_ATTEMPTS || !result.retryable;
      await prisma.postTarget.update({
        where: { id: target.id },
        data: {
          status: exhausted ? "FAILED" : "PENDING",
          error: result.error?.slice(0, 1000) ?? "Unknown error",
        },
      });
      await prisma.socialAccount.update({
        where: { id: target.accountId },
        data: { lastError: result.error?.slice(0, 500) ?? null, lastErrorAt: new Date() },
      });
    }
  }

  const total = post.targets.length;
  const status =
    published === total
      ? "PUBLISHED"
      : published > 0
        ? "PARTIAL"
        : "FAILED";

  await prisma.post.update({
    where: { id: postId },
    data: {
      status,
      publishedAt: published > 0 ? new Date() : null,
    },
  });

  await prisma.activityLog.create({
    data: {
      workspaceId: post.workspaceId,
      userId: post.authorId,
      action: `post.${status.toLowerCase()}`,
      entityType: "post",
      entityId: post.id,
      detail:
        status === "PUBLISHED"
          ? `Published to ${published} destination(s).`
          : `${published} of ${total} destination(s) succeeded.`,
    },
  });

  return { postId, published, failed, status };
}

/** Finds and publishes everything whose scheduled time has arrived. */
export async function publishDuePosts(limit = 10): Promise<PublishPostResult[]> {
  const due = await prisma.post.findMany({
    where: {
      status: { in: ["SCHEDULED", "QUEUED"] },
      scheduledAt: { lte: new Date() },
    },
    orderBy: { scheduledAt: "asc" },
    take: limit,
    select: { id: true },
  });

  const results: PublishPostResult[] = [];
  for (const p of due) {
    results.push(await publishPost(p.id));
  }
  return results;
}

/**
 * Buffer-style queue: find the next free slot in the weekly posting schedule.
 * Walks forward from now, skipping slots already taken by a scheduled post.
 */
export async function nextQueueSlot(
  workspaceId: string,
  after: Date = new Date(),
): Promise<Date> {
  const slots = await prisma.queueSlot.findMany({
    where: { workspaceId, enabled: true },
    orderBy: [{ dayOfWeek: "asc" }, { hour: "asc" }, { minute: "asc" }],
  });

  // No schedule configured - put it an hour out so it is still deterministic.
  if (slots.length === 0) {
    return new Date(after.getTime() + 3_600_000);
  }

  const taken = new Set(
    (
      await prisma.post.findMany({
        where: {
          workspaceId,
          status: { in: ["SCHEDULED", "QUEUED"] },
          scheduledAt: { gte: after },
        },
        select: { scheduledAt: true },
      })
    )
      .map((p) => p.scheduledAt?.getTime())
      .filter((t): t is number => typeof t === "number"),
  );

  // Look ahead eight weeks; that is far more queue than anyone fills.
  for (let dayOffset = 0; dayOffset < 56; dayOffset++) {
    const day = new Date(after);
    day.setUTCDate(day.getUTCDate() + dayOffset);
    const dow = day.getUTCDay();

    for (const slot of slots.filter((s) => s.dayOfWeek === dow)) {
      const candidate = new Date(day);
      candidate.setUTCHours(slot.hour, slot.minute, 0, 0);
      if (candidate.getTime() <= after.getTime()) continue;
      if (taken.has(candidate.getTime())) continue;
      return candidate;
    }
  }
  return new Date(after.getTime() + 3_600_000);
}
