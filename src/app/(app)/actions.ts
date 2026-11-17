"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { can, destroySession, requireUser } from "@/lib/auth";
import { encryptJson, encryptSecret, randomToken } from "@/lib/crypto";
import { getPlatform, platformOrFallback } from "@/lib/platforms/registry";
import { connectMode } from "@/lib/platforms/oauth";
import { validateForPlatform, splitIntoThread } from "@/lib/platforms/validate";
import { nextQueueSlot, publishPost } from "@/lib/worker/publish";
import { syncAccountAnalytics } from "@/lib/worker/analytics";
import {
  runComposer,
  runHashtagStrategist,
  runPerformanceAnalyst,
  runProfileAuditor,
  runQueueOptimizer,
  runTimingOracle,
  runTrendScout,
} from "@/lib/agents/run";
import type { ComposerOutput, HashtagOutput } from "@/lib/agents/schemas";

/**
 * Every mutation in the app.
 *
 * All of them start by resolving the session and checking the caller's role -
 * a server action is a public HTTP endpoint, so it cannot trust that the UI
 * only showed the button to people allowed to press it.
 */

export type ActionState = { ok?: boolean; error?: string; message?: string };

async function logActivity(
  workspaceId: string,
  userId: string,
  action: string,
  detail?: string,
  entityType?: string,
  entityId?: string,
) {
  await prisma.activityLog.create({
    data: { workspaceId, userId, action, detail, entityType, entityId },
  });
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function switchWorkspaceAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  // Only switch to a workspace this user actually belongs to.
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
  });
  if (membership) {
    const { createSession } = await import("@/lib/auth");
    await createSession({ userId: user.id, email: user.email, workspaceId });
  }
  revalidatePath("/", "layout");
  redirect("/");
}

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

export async function connectAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!can(user.role, "manageAccounts")) {
    return { error: "Your role cannot manage connections." };
  }

  const platform = String(formData.get("platform") ?? "");
  const def = getPlatform(platform);
  if (!def) return { error: "Unknown platform." };

  const handle = String(formData.get("handle") ?? "").trim().replace(/^@/, "");
  if (!handle) return { error: "Enter the account handle or name." };

  const displayName = String(formData.get("displayName") ?? "").trim() || handle;
  const mode = connectMode(platform);

  // Collect whatever extra fields this platform asked for.
  const config: Record<string, string> = {};
  let missing: string | null = null;
  for (const field of def.connectFields ?? []) {
    const value = String(formData.get(`field_${field.name}`) ?? "").trim();
    if (field.required && !value) missing = field.label;
    if (value) config[field.name] = value;
  }

  // A token-auth platform needs its credentials to do anything real; without
  // them, say so rather than silently creating a dead connection.
  const asSandbox = formData.get("sandbox") === "on" || mode === "sandbox";
  if (!asSandbox && missing) {
    return { error: `${missing} is required to connect ${def.name} for real.` };
  }

  const existing = await prisma.socialAccount.findUnique({
    where: {
      workspaceId_platform_handle: {
        workspaceId: user.workspace.id,
        platform,
        handle,
      },
    },
  });
  if (existing) {
    return { error: `${def.name} account @${handle} is already connected.` };
  }

  // Sandbox accounts get a plausible follower base so analytics and the agents
  // have something to work with immediately.
  const seedFollowers = asSandbox
    ? 400 + Math.floor(Math.random() * 24_000)
    : 0;

  const account = await prisma.socialAccount.create({
    data: {
      workspaceId: user.workspace.id,
      platform,
      handle,
      displayName,
      status: "CONNECTED",
      connection: asSandbox ? "SANDBOX" : def.auth === "webhook" ? "WEBHOOK" : "TOKEN",
      config: Object.keys(config).length ? encryptJson(config) : null,
      followers: seedFollowers,
      following: asSandbox ? Math.floor(seedFollowers * 0.12) : 0,
      bio: asSandbox ? `${displayName} on ${def.name}.` : null,
      profileUrl: config.instance
        ? `${config.instance.replace(/\/+$/, "")}/@${handle}`
        : null,
      lastSyncedAt: new Date(),
    },
  });

  // Build its history straight away so the dashboard is not empty.
  await syncAccountAnalytics(account.id).catch(() => {
    /* analytics can catch up on the next worker tick */
  });

  await logActivity(
    user.workspace.id,
    user.id,
    "account.connected",
    `${def.name} @${handle}${asSandbox ? " (sandbox)" : ""}`,
    "account",
    account.id,
  );

  revalidatePath("/accounts");
  revalidatePath("/");
  return {
    ok: true,
    message: `${def.name} @${handle} connected${asSandbox ? " in sandbox mode" : ""}.`,
  };
}

export async function disconnectAccountAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "manageAccounts")) return;

  const accountId = String(formData.get("accountId") ?? "");
  // Scope the delete to this workspace so an id from elsewhere cannot be used.
  const account = await prisma.socialAccount.findFirst({
    where: { id: accountId, workspaceId: user.workspace.id },
  });
  if (!account) return;

  await prisma.socialAccount.delete({ where: { id: account.id } });
  await logActivity(
    user.workspace.id,
    user.id,
    "account.disconnected",
    `${platformOrFallback(account.platform).name} @${account.handle}`,
  );
  revalidatePath("/accounts");
  revalidatePath("/");
}

export async function syncAccountAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const accountId = String(formData.get("accountId") ?? "");
  const account = await prisma.socialAccount.findFirst({
    where: { id: accountId, workspaceId: user.workspace.id },
    select: { id: true },
  });
  if (!account) return;
  await syncAccountAnalytics(account.id);
  revalidatePath("/accounts");
  revalidatePath("/analytics");
}

// ---------------------------------------------------------------------------
// Composer / posts
// ---------------------------------------------------------------------------

export interface SavePostState extends ActionState {
  postId?: string;
  validation?: Array<{ platform: string; errors: string[] }>;
}

export async function savePostAction(
  _prev: SavePostState,
  formData: FormData,
): Promise<SavePostState> {
  const user = await requireUser();
  if (!can(user.role, "edit")) {
    return { error: "Your role cannot create posts." };
  }

  const baseContent = String(formData.get("baseContent") ?? "");
  const accountIds = formData.getAll("accountIds").map(String).filter(Boolean);
  const intent = String(formData.get("intent") ?? "draft"); // draft | schedule | queue | now
  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "");
  const firstComment = String(formData.get("firstComment") ?? "").trim();
  const link = String(formData.get("link") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const mediaIds = formData.getAll("mediaIds").map(String).filter(Boolean);
  const existingPostId = String(formData.get("postId") ?? "");

  if (accountIds.length === 0) {
    return { error: "Choose at least one account to post to." };
  }
  if (!baseContent.trim() && mediaIds.length === 0) {
    return { error: "Write something, or attach an image." };
  }

  // Only accounts in this workspace.
  const accounts = await prisma.socialAccount.findMany({
    where: { id: { in: accountIds }, workspaceId: user.workspace.id },
  });
  if (accounts.length === 0) {
    return { error: "None of the selected accounts belong to this workspace." };
  }

  const media = await prisma.mediaAsset.findMany({
    where: { id: { in: mediaIds }, workspaceId: user.workspace.id },
  });

  // Validate per platform before writing anything.
  const validation: Array<{ platform: string; errors: string[] }> = [];
  for (const account of accounts) {
    const override = String(formData.get(`content_${account.id}`) ?? "").trim();
    const content = override || baseContent;
    const options = collectOptions(formData, account.id, account.platform);
    const v = validateForPlatform(
      account.platform,
      content,
      media.map((m) => ({ kind: m.kind, alt: m.alt })),
      options,
    );
    const errors = v.issues.filter((i) => i.level === "error").map((i) => i.message);
    if (errors.length > 0) {
      validation.push({ platform: account.platform, errors });
    }
  }

  // Publishing or scheduling with errors would just fail later - stop here.
  // Drafts are allowed to be invalid; that is what a draft is for.
  if (validation.length > 0 && intent !== "draft") {
    return {
      error: "Some platforms would reject this post. Fix the errors and try again.",
      validation,
    };
  }

  if ((intent === "now" || intent === "schedule" || intent === "queue") && !can(user.role, "publish")) {
    return {
      error:
        "Your role can draft posts but not publish them. Save it as a draft and ask an editor to send it.",
    };
  }

  let scheduledAt: Date | null = null;
  let status = "DRAFT";

  if (intent === "schedule") {
    const parsed = scheduledAtRaw ? new Date(scheduledAtRaw) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
      return { error: "Pick a valid date and time to schedule." };
    }
    if (parsed.getTime() < Date.now() - 60_000) {
      return { error: "That time is in the past. Pick a future time, or publish now." };
    }
    scheduledAt = parsed;
    status = "SCHEDULED";
  } else if (intent === "queue") {
    scheduledAt = await nextQueueSlot(user.workspace.id);
    status = "QUEUED";
  } else if (intent === "now") {
    scheduledAt = new Date();
    status = "SCHEDULED"; // the publisher picks it up below
  }

  const tags = JSON.stringify(
    [...new Set((baseContent.match(/(?:^|\s)#([A-Za-z0-9_]{2,})/g) ?? []).map((t) => t.trim().slice(1)))].slice(0, 30),
  );

  const postData = {
    workspaceId: user.workspace.id,
    authorId: user.id,
    title: title || null,
    baseContent,
    status,
    scheduledAt,
    useNextSlot: intent === "queue",
    firstComment: firstComment || null,
    link: link || null,
    tags,
  };

  let postId: string;
  if (existingPostId) {
    const existing = await prisma.post.findFirst({
      where: { id: existingPostId, workspaceId: user.workspace.id },
    });
    if (!existing) return { error: "That post no longer exists." };
    if (existing.status === "PUBLISHED") {
      return { error: "This post has already gone out and cannot be edited." };
    }
    await prisma.post.update({ where: { id: existing.id }, data: postData });
    // Replace targets and media wholesale - simpler and always consistent.
    await prisma.postTarget.deleteMany({ where: { postId: existing.id } });
    await prisma.postMedia.deleteMany({ where: { postId: existing.id } });
    postId = existing.id;
  } else {
    const created = await prisma.post.create({ data: postData });
    postId = created.id;
  }

  for (const account of accounts) {
    const override = String(formData.get(`content_${account.id}`) ?? "").trim();
    const content = override || baseContent;
    const def = platformOrFallback(account.platform);
    const options = collectOptions(formData, account.id, account.platform);

    // Auto-thread where the platform supports it and the copy is too long.
    let threadParts: string[] = [];
    let finalContent = content;
    if (content.length > def.charLimit && def.capabilities.includes("thread")) {
      const parts = splitIntoThread(content, def.charLimit);
      finalContent = parts[0];
      threadParts = parts.slice(1);
    }

    await prisma.postTarget.create({
      data: {
        postId,
        accountId: account.id,
        content: finalContent === baseContent ? null : finalContent,
        threadParts: threadParts.length ? JSON.stringify(threadParts) : null,
        options: Object.keys(options).length ? JSON.stringify(options) : null,
        status: "PENDING",
      },
    });
  }

  for (const [i, m] of media.entries()) {
    await prisma.postMedia.create({
      data: { postId, mediaId: m.id, position: i },
    });
  }

  await logActivity(
    user.workspace.id,
    user.id,
    `post.${intent}`,
    `${accounts.length} destination(s)`,
    "post",
    postId,
  );

  // Publish immediately rather than waiting for the next worker tick, so
  // "Publish now" means now.
  if (intent === "now") {
    const result = await publishPost(postId);
    revalidatePath("/");
    revalidatePath("/queue");
    revalidatePath("/calendar");
    return {
      ok: true,
      postId,
      message:
        result.status === "PUBLISHED"
          ? `Published to ${result.published} destination(s).`
          : result.status === "PARTIAL"
            ? `Published to ${result.published} of ${result.published + result.failed}. Check the queue for the failures.`
            : "Publishing failed on every destination. Check the queue for details.",
    };
  }

  revalidatePath("/");
  revalidatePath("/queue");
  revalidatePath("/calendar");

  const messages: Record<string, string> = {
    draft: "Saved as a draft.",
    schedule: `Scheduled for ${scheduledAt?.toUTCString() ?? "later"}.`,
    queue: `Added to the queue - it goes out ${scheduledAt?.toUTCString() ?? "in the next slot"}.`,
  };
  return { ok: true, postId, message: messages[intent] ?? "Saved." };
}

/** Pulls this account's platform-specific composer options out of the form. */
function collectOptions(
  formData: FormData,
  accountId: string,
  platform: string,
): Record<string, string | boolean> {
  const def = platformOrFallback(platform);
  const out: Record<string, string | boolean> = {};
  for (const opt of def.postOptions ?? []) {
    const raw = formData.get(`opt_${accountId}_${opt.name}`);
    if (raw === null) continue;
    if (opt.type === "boolean") {
      out[opt.name] = raw === "on" || raw === "true";
    } else {
      const v = String(raw).trim();
      if (v) out[opt.name] = v;
    }
  }
  return out;
}

export async function deletePostAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "edit")) return;
  const postId = String(formData.get("postId") ?? "");
  const post = await prisma.post.findFirst({
    where: { id: postId, workspaceId: user.workspace.id },
  });
  if (!post) return;
  await prisma.post.delete({ where: { id: post.id } });
  await logActivity(user.workspace.id, user.id, "post.deleted", post.baseContent.slice(0, 80));
  revalidatePath("/queue");
  revalidatePath("/calendar");
  revalidatePath("/");
}

export async function publishNowAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "publish")) return;
  const postId = String(formData.get("postId") ?? "");
  const post = await prisma.post.findFirst({
    where: { id: postId, workspaceId: user.workspace.id },
    select: { id: true, status: true },
  });
  if (!post || post.status === "PUBLISHED") return;
  await publishPost(post.id);
  revalidatePath("/queue");
  revalidatePath("/");
  revalidatePath("/calendar");
}

export async function reschedulePostAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "publish")) return;
  const postId = String(formData.get("postId") ?? "");
  const whenRaw = String(formData.get("scheduledAt") ?? "");
  const when = new Date(whenRaw);
  if (Number.isNaN(when.getTime())) return;

  const post = await prisma.post.findFirst({
    where: { id: postId, workspaceId: user.workspace.id },
    select: { id: true, status: true },
  });
  if (!post || post.status === "PUBLISHED") return;

  await prisma.post.update({
    where: { id: post.id },
    data: { scheduledAt: when, status: "SCHEDULED" },
  });
  await logActivity(user.workspace.id, user.id, "post.rescheduled", when.toUTCString());
  revalidatePath("/queue");
  revalidatePath("/calendar");
}

export async function approvePostAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "publish")) return;
  const postId = String(formData.get("postId") ?? "");
  const post = await prisma.post.findFirst({
    where: { id: postId, workspaceId: user.workspace.id, status: "NEEDS_APPROVAL" },
  });
  if (!post) return;

  await prisma.post.update({
    where: { id: post.id },
    data: {
      status: post.scheduledAt ? "SCHEDULED" : "QUEUED",
      scheduledAt: post.scheduledAt ?? (await nextQueueSlot(user.workspace.id)),
      approvedById: user.id,
      approvedAt: new Date(),
    },
  });
  await logActivity(user.workspace.id, user.id, "post.approved", undefined, "post", post.id);
  revalidatePath("/queue");
}

export async function retryTargetAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "publish")) return;
  const targetId = String(formData.get("targetId") ?? "");
  const target = await prisma.postTarget.findFirst({
    where: { id: targetId, account: { workspaceId: user.workspace.id } },
    include: { post: true },
  });
  if (!target) return;

  // Reset the attempt counter so the publisher will try again.
  await prisma.postTarget.update({
    where: { id: target.id },
    data: { status: "PENDING", attempts: 0, error: null },
  });
  await publishPost(target.postId);
  revalidatePath("/queue");
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export async function addMediaByUrlAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!can(user.role, "edit")) return { error: "Your role cannot add media." };

  const url = String(formData.get("url") ?? "").trim();
  const alt = String(formData.get("alt") ?? "").trim();
  const kind = String(formData.get("kind") ?? "image");

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { error: "That is not a valid URL." };
  }
  // Only fetchable public schemes - a file:// or data: URL here would be a
  // way to point the server at something it should not read.
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { error: "Media URLs must start with http:// or https://" };
  }

  await prisma.mediaAsset.create({
    data: {
      workspaceId: user.workspace.id,
      url,
      kind: ["image", "video", "gif", "document"].includes(kind) ? kind : "image",
      alt: alt || null,
    },
  });
  revalidatePath("/composer");
  return { ok: true, message: "Media added to the library." };
}

export async function deleteMediaAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "edit")) return;
  const mediaId = String(formData.get("mediaId") ?? "");
  const media = await prisma.mediaAsset.findFirst({
    where: { id: mediaId, workspaceId: user.workspace.id },
  });
  if (!media) return;
  await prisma.mediaAsset.delete({ where: { id: media.id } });
  revalidatePath("/composer");
}

// ---------------------------------------------------------------------------
// AI agents
// ---------------------------------------------------------------------------

export interface AgentActionState extends ActionState {
  composer?: ComposerOutput;
  hashtags?: HashtagOutput;
  engine?: string;
}

export async function runComposerAction(
  _prev: AgentActionState,
  formData: FormData,
): Promise<AgentActionState> {
  const user = await requireUser();
  if (!can(user.role, "runAgents")) return { error: "Your role cannot run agents." };

  const idea = String(formData.get("idea") ?? "").trim();
  const platforms = formData.getAll("platforms").map(String).filter(Boolean);
  const tone = String(formData.get("tone") ?? "").trim();
  const callToAction = String(formData.get("callToAction") ?? "").trim();
  const link = String(formData.get("link") ?? "").trim();

  if (idea.length < 10) {
    return { error: "Give the agent a bit more to work with - at least a sentence." };
  }
  if (platforms.length === 0) {
    return { error: "Pick at least one platform to write for." };
  }

  // Show the agent what has worked recently, so it matches a voice that lands.
  const recent = await prisma.postTarget.findMany({
    where: {
      status: "PUBLISHED",
      account: { workspaceId: user.workspace.id, platform: { in: platforms } },
    },
    include: { post: true, account: true, metrics: { orderBy: { capturedAt: "desc" }, take: 1 } },
    orderBy: { publishedAt: "desc" },
    take: 30,
  });
  const examples = recent
    .map((t) => ({
      platform: t.account.platform,
      content: t.content ?? t.post.baseContent,
      engagementRate: t.metrics[0]?.engagementRate ?? 0,
    }))
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .slice(0, 5);

  try {
    const { result, engine, note } = await runComposer(
      { workspaceId: user.workspace.id, trigger: "manual" },
      {
        idea,
        platforms,
        brandVoice: user.workspace.brandVoice,
        tone: tone || undefined,
        callToAction: callToAction || undefined,
        link: link || undefined,
        examples,
      },
    );
    revalidatePath("/agents");
    return {
      ok: true,
      composer: result,
      engine,
      message: note ?? `${result.variants.length} draft(s) ready.`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "The composer agent failed." };
  }
}

export async function runHashtagAction(
  _prev: AgentActionState,
  formData: FormData,
): Promise<AgentActionState> {
  const user = await requireUser();
  if (!can(user.role, "runAgents")) return { error: "Your role cannot run agents." };

  const idea = String(formData.get("idea") ?? "").trim();
  const platforms = formData.getAll("platforms").map(String).filter(Boolean);
  if (!idea || platforms.length === 0) {
    return { error: "Write the post and pick platforms first." };
  }

  try {
    const { result, engine, note } = await runHashtagStrategist(
      { workspaceId: user.workspace.id, trigger: "manual" },
      { idea, platforms, brandVoice: user.workspace.brandVoice },
    );
    return { ok: true, hashtags: result, engine, message: note ?? result.summary };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "The hashtag agent failed." };
  }
}

export async function runAgentAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "runAgents")) return;
  const agent = String(formData.get("agent") ?? "");
  const meta = { workspaceId: user.workspace.id, trigger: "manual" as const };

  try {
    switch (agent) {
      case "timing-oracle":
        await runTimingOracle(meta);
        break;
      case "performance-analyst":
        await runPerformanceAnalyst(meta);
        break;
      case "profile-auditor":
        await runProfileAuditor(meta);
        break;
      case "trend-scout":
        await runTrendScout(meta);
        break;
      case "queue-optimizer":
        await runQueueOptimizer(meta);
        break;
      default:
        return;
    }
  } catch {
    // The run row already records the failure; nothing more to do here.
  }

  revalidatePath("/agents");
  revalidatePath("/insights");
  revalidatePath("/analytics");
  revalidatePath("/");
}

export async function toggleAutomationAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "runAgents")) return;
  const ruleId = String(formData.get("ruleId") ?? "");
  const rule = await prisma.automationRule.findFirst({
    where: { id: ruleId, workspaceId: user.workspace.id },
  });
  if (!rule) return;
  await prisma.automationRule.update({
    where: { id: rule.id },
    data: {
      enabled: !rule.enabled,
      nextRunAt: !rule.enabled ? new Date(Date.now() + 30_000) : null,
    },
  });
  revalidatePath("/agents");
}

export async function updateAutomationIntervalAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "runAgents")) return;
  const ruleId = String(formData.get("ruleId") ?? "");
  const minutes = Number.parseInt(String(formData.get("intervalMinutes") ?? ""), 10);
  if (!Number.isFinite(minutes) || minutes < 15 || minutes > 10_080) return;

  const rule = await prisma.automationRule.findFirst({
    where: { id: ruleId, workspaceId: user.workspace.id },
  });
  if (!rule) return;
  await prisma.automationRule.update({
    where: { id: rule.id },
    data: {
      intervalMinutes: minutes,
      nextRunAt: new Date(Date.now() + minutes * 60_000),
    },
  });
  revalidatePath("/agents");
}

export async function applyQueueMoveAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "publish")) return;
  const postId = String(formData.get("postId") ?? "");
  const toIso = String(formData.get("toIso") ?? "");
  const when = new Date(toIso);
  if (Number.isNaN(when.getTime()) || when.getTime() < Date.now()) return;

  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      workspaceId: user.workspace.id,
      status: { in: ["SCHEDULED", "QUEUED"] },
    },
    select: { id: true },
  });
  if (!post) return;
  await prisma.post.update({
    where: { id: post.id },
    data: { scheduledAt: when, status: "SCHEDULED" },
  });
  revalidatePath("/agents");
  revalidatePath("/queue");
  revalidatePath("/calendar");
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

export async function markInsightReadAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const insightId = String(formData.get("insightId") ?? "");
  await prisma.insight.updateMany({
    where: { id: insightId, workspaceId: user.workspace.id },
    data: { readAt: new Date() },
  });
  revalidatePath("/insights");
  revalidatePath("/", "layout");
}

export async function markAllInsightsReadAction(): Promise<void> {
  const user = await requireUser();
  await prisma.insight.updateMany({
    where: { workspaceId: user.workspace.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/insights");
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

export async function inviteMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!can(user.role, "manageTeam")) {
    return { error: "Only owners and admins can invite people." };
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "EDITOR");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (!["ADMIN", "EDITOR", "CONTRIBUTOR", "VIEWER"].includes(role)) {
    return { error: "Pick a valid role." };
  }

  // Already a member?
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const membership = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: existingUser.id, workspaceId: user.workspace.id } },
    });
    if (membership) return { error: "That person is already in this workspace." };

    // Existing Chorus user - add them straight away.
    await prisma.membership.create({
      data: { userId: existingUser.id, workspaceId: user.workspace.id, role },
    });
    await logActivity(user.workspace.id, user.id, "member.added", `${email} as ${role}`);
    revalidatePath("/team");
    return { ok: true, message: `${existingUser.name} was added to the workspace.` };
  }

  const pending = await prisma.invite.findFirst({
    where: { workspaceId: user.workspace.id, email, acceptedAt: null },
  });
  if (pending) return { error: "An invite is already pending for that address." };

  const invite = await prisma.invite.create({
    data: {
      workspaceId: user.workspace.id,
      email,
      role,
      token: randomToken(24),
      invitedById: user.id,
      expiresAt: new Date(Date.now() + 14 * 86_400_000),
    },
  });
  await logActivity(user.workspace.id, user.id, "member.invited", `${email} as ${role}`);
  revalidatePath("/team");
  return {
    ok: true,
    message: `Invite created for ${email}. Share this link: /invite/${invite.token}`,
  };
}

export async function changeRoleAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "manageTeam")) return;
  const membershipId = String(formData.get("membershipId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!["OWNER", "ADMIN", "EDITOR", "CONTRIBUTOR", "VIEWER"].includes(role)) return;

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, workspaceId: user.workspace.id },
  });
  if (!membership) return;

  // A workspace must keep at least one owner, or nobody can administer it.
  if (membership.role === "OWNER" && role !== "OWNER") {
    const owners = await prisma.membership.count({
      where: { workspaceId: user.workspace.id, role: "OWNER" },
    });
    if (owners <= 1) return;
  }
  // Only an owner may create another owner.
  if (role === "OWNER" && user.role !== "OWNER") return;

  await prisma.membership.update({ where: { id: membership.id }, data: { role } });
  await logActivity(user.workspace.id, user.id, "member.role_changed", role);
  revalidatePath("/team");
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "manageTeam")) return;
  const membershipId = String(formData.get("membershipId") ?? "");
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, workspaceId: user.workspace.id },
    include: { user: true },
  });
  if (!membership) return;
  if (membership.userId === user.id) return; // use "leave workspace" for that

  if (membership.role === "OWNER") {
    const owners = await prisma.membership.count({
      where: { workspaceId: user.workspace.id, role: "OWNER" },
    });
    if (owners <= 1) return;
  }

  await prisma.membership.delete({ where: { id: membership.id } });
  await logActivity(user.workspace.id, user.id, "member.removed", membership.user.email);
  revalidatePath("/team");
}

export async function revokeInviteAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "manageTeam")) return;
  const inviteId = String(formData.get("inviteId") ?? "");
  await prisma.invite.deleteMany({
    where: { id: inviteId, workspaceId: user.workspace.id },
  });
  revalidatePath("/team");
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const jobTitle = String(formData.get("jobTitle") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim();

  if (name.length < 2) return { error: "Enter your name." };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name,
      jobTitle: jobTitle || null,
      timezone: timezone || user.timezone,
    },
  });
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile updated." };
}

export async function updatePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (next.length < 8) return { error: "The new password needs at least 8 characters." };
  if (next !== confirm) return { error: "The two new passwords do not match." };

  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record) return { error: "Account not found." };

  const { verifyPassword, hashPassword } = await import("@/lib/crypto");
  if (!verifyPassword(current, record.passwordHash)) {
    return { error: "Your current password is not correct." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(next) },
  });
  await logActivity(user.workspace.id, user.id, "user.password_changed");
  return { ok: true, message: "Password changed." };
}

export async function updateWorkspaceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!can(user.role, "manageTeam")) {
    return { error: "Only owners and admins can change workspace settings." };
  }
  const name = String(formData.get("name") ?? "").trim();
  const brandVoice = String(formData.get("brandVoice") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim();
  const weekStart = Number.parseInt(String(formData.get("weekStart") ?? "1"), 10);

  if (name.length < 2) return { error: "Enter a workspace name." };

  await prisma.workspace.update({
    where: { id: user.workspace.id },
    data: {
      name,
      brandVoice: brandVoice || user.workspace.brandVoice,
      timezone: timezone || user.workspace.timezone,
      weekStart: weekStart === 0 ? 0 : 1,
    },
  });
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true, message: "Workspace updated." };
}

export async function addQueueSlotAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "publish")) return;
  const dayOfWeek = Number.parseInt(String(formData.get("dayOfWeek") ?? ""), 10);
  const time = String(formData.get("time") ?? "");
  const [hStr, mStr] = time.split(":");
  const hour = Number.parseInt(hStr ?? "", 10);
  const minute = Number.parseInt(mStr ?? "0", 10);

  if (
    !Number.isFinite(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 ||
    !Number.isFinite(hour) || hour < 0 || hour > 23 ||
    !Number.isFinite(minute) || minute < 0 || minute > 59
  ) {
    return;
  }

  const existing = await prisma.queueSlot.findFirst({
    where: { workspaceId: user.workspace.id, dayOfWeek, hour, minute, accountId: null },
  });
  if (existing) return;

  await prisma.queueSlot.create({
    data: { workspaceId: user.workspace.id, dayOfWeek, hour, minute },
  });
  revalidatePath("/settings");
  revalidatePath("/queue");
}

export async function deleteQueueSlotAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "publish")) return;
  const slotId = String(formData.get("slotId") ?? "");
  await prisma.queueSlot.deleteMany({
    where: { id: slotId, workspaceId: user.workspace.id },
  });
  revalidatePath("/settings");
  revalidatePath("/queue");
}

export async function applyRecommendedSlotsAction(): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "publish")) return;

  // Take the strongest slots the Timing Oracle found and turn them into the
  // posting schedule.
  const best = await prisma.bestTime.findMany({
    where: { account: { workspaceId: user.workspace.id } },
    orderBy: { score: "desc" },
    take: 60,
  });
  if (best.length === 0) return;

  const seen = new Set<string>();
  const picks: Array<{ dayOfWeek: number; hour: number }> = [];
  for (const b of best) {
    const key = `${b.dayOfWeek}-${b.hour}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picks.push({ dayOfWeek: b.dayOfWeek, hour: b.hour });
    if (picks.length >= 14) break;
  }

  await prisma.queueSlot.deleteMany({
    where: { workspaceId: user.workspace.id, source: "ai" },
  });
  for (const p of picks) {
    const clash = await prisma.queueSlot.findFirst({
      where: {
        workspaceId: user.workspace.id,
        dayOfWeek: p.dayOfWeek,
        hour: p.hour,
        minute: 0,
      },
    });
    if (clash) continue;
    await prisma.queueSlot.create({
      data: {
        workspaceId: user.workspace.id,
        dayOfWeek: p.dayOfWeek,
        hour: p.hour,
        minute: 0,
        source: "ai",
      },
    });
  }
  await logActivity(
    user.workspace.id,
    user.id,
    "queue.slots_applied",
    `${picks.length} AI-recommended slot(s)`,
  );
  revalidatePath("/settings");
  revalidatePath("/queue");
}
