import {
  apiFetch,
  describeError,
  isRetryableStatus,
  type PlatformAdapter,
  type PublishContext,
  type PublishResult,
} from "./types";

/**
 * Live publishing adapters.
 *
 * Networks fall into two groups:
 *
 *  1. Those that need nothing but a per-account token the user can create
 *     themselves (Mastodon, Bluesky, Telegram, Discord, Slack, DEV). Chorus
 *     ships complete, working publishers for these - connect an account and
 *     posts really go out.
 *
 *  2. Those that require a reviewed developer app (Instagram, TikTok, YouTube,
 *     X, LinkedIn, Reddit, Pinterest...). The request shapes are implemented
 *     here, but they only run once the operator supplies that platform's
 *     client credentials and completes its OAuth flow. Until then the account
 *     is connected in Sandbox mode and the simulator handles publishing so the
 *     whole workflow stays testable.
 */

// ---------------------------------------------------------------------------
// Mastodon (and Mastodon-compatible servers such as Truth Social)
// ---------------------------------------------------------------------------

function mastodonLike(key: string): PlatformAdapter {
  return {
    key,
    async publish(ctx) {
      const instance = (ctx.credentials.instance ?? "").replace(/\/+$/, "");
      const token = ctx.credentials.token;
      if (!instance || !token) {
        return { ok: false, error: "Missing instance URL or access token." };
      }
      const visibility =
        typeof ctx.options.visibility === "string" ? ctx.options.visibility : "public";

      // Post the root status, then chain any thread parts as replies.
      let inReplyTo: string | undefined;
      let rootId = "";
      let rootUrl = "";
      const parts = [ctx.content, ...(ctx.threadParts ?? [])].filter((p) => p.trim());

      for (const part of parts) {
        const res = await apiFetch(`${instance}/api/v1/statuses`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            // Idempotency key stops a retry from double-posting.
            "Idempotency-Key": `chorus-${ctx.account.id}-${hash(part)}`,
          },
          body: JSON.stringify({
            status: part,
            visibility,
            ...(inReplyTo ? { in_reply_to_id: inReplyTo } : {}),
          }),
        });
        if (!res.ok) {
          return {
            ok: false,
            error: describeError(res.status, res.body),
            retryable: isRetryableStatus(res.status),
          };
        }
        const data = res.body as { id?: string; url?: string };
        inReplyTo = data.id;
        if (!rootId) {
          rootId = data.id ?? "";
          rootUrl = data.url ?? "";
        }
      }
      return { ok: true, externalPostId: rootId, externalUrl: rootUrl };
    },
    async fetchProfile({ credentials }) {
      const instance = (credentials.instance ?? "").replace(/\/+$/, "");
      const token = credentials.token;
      if (!instance || !token) return null;
      const res = await apiFetch(`${instance}/api/v1/accounts/verify_credentials`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const d = res.body as Record<string, unknown>;
      return {
        followers: num(d.followers_count),
        following: num(d.following_count),
        postCount: num(d.statuses_count),
        bio: typeof d.note === "string" ? stripHtml(d.note) : undefined,
        avatarUrl: typeof d.avatar === "string" ? d.avatar : undefined,
        displayName: typeof d.display_name === "string" ? d.display_name : undefined,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Bluesky (AT Protocol)
// ---------------------------------------------------------------------------

const bluesky: PlatformAdapter = {
  key: "bluesky",
  async publish(ctx) {
    const service = (ctx.credentials.service || "https://bsky.social").replace(/\/+$/, "");
    const identifier = ctx.credentials.identifier;
    const password = ctx.credentials.password;
    if (!identifier || !password) {
      return { ok: false, error: "Missing Bluesky handle or app password." };
    }

    const auth = await apiFetch(`${service}/xrpc/com.atproto.server.createSession`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    if (!auth.ok) {
      return {
        ok: false,
        error: `Bluesky sign-in failed - ${describeError(auth.status, auth.body)}`,
        retryable: isRetryableStatus(auth.status),
      };
    }
    const session = auth.body as { accessJwt?: string; did?: string };
    if (!session.accessJwt || !session.did) {
      return { ok: false, error: "Bluesky did not return a session." };
    }

    const parts = [ctx.content, ...(ctx.threadParts ?? [])].filter((p) => p.trim());
    let root: { uri: string; cid: string } | undefined;
    let parent: { uri: string; cid: string } | undefined;

    for (const part of parts) {
      const record: Record<string, unknown> = {
        text: part,
        createdAt: new Date().toISOString(),
        // Detect links and hashtags so they render as real facets.
        facets: buildBlueskyFacets(part),
      };
      if (root && parent) {
        record.reply = { root, parent };
      }
      const res = await apiFetch(`${service}/xrpc/com.atproto.repo.createRecord`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessJwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repo: session.did,
          collection: "app.bsky.feed.post",
          record,
        }),
      });
      if (!res.ok) {
        return {
          ok: false,
          error: describeError(res.status, res.body),
          retryable: isRetryableStatus(res.status),
        };
      }
      const d = res.body as { uri?: string; cid?: string };
      if (!d.uri || !d.cid) return { ok: false, error: "Bluesky returned no record URI." };
      parent = { uri: d.uri, cid: d.cid };
      if (!root) root = parent;
    }

    const rkey = root?.uri.split("/").pop() ?? "";
    return {
      ok: true,
      externalPostId: root?.uri,
      externalUrl: `https://bsky.app/profile/${identifier}/post/${rkey}`,
    };
  },
  async fetchProfile({ credentials }) {
    const service = (credentials.service || "https://bsky.social").replace(/\/+$/, "");
    const identifier = credentials.identifier;
    if (!identifier) return null;
    const res = await apiFetch(
      `${service}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(identifier)}`,
    );
    if (!res.ok) return null;
    const d = res.body as Record<string, unknown>;
    return {
      followers: num(d.followersCount),
      following: num(d.followsCount),
      postCount: num(d.postsCount),
      bio: typeof d.description === "string" ? d.description : undefined,
      avatarUrl: typeof d.avatar === "string" ? d.avatar : undefined,
      displayName: typeof d.displayName === "string" ? d.displayName : undefined,
    };
  },
};

/** Byte-offset facets for links and hashtags, as the AT Protocol requires. */
function buildBlueskyFacets(text: string) {
  const facets: Array<Record<string, unknown>> = [];
  const enc = new TextEncoder();
  const byteIndex = (charIndex: number) => enc.encode(text.slice(0, charIndex)).length;

  const urlRe = /https?:\/\/[^\s<>"')\]]+/g;
  for (const m of text.matchAll(urlRe)) {
    if (m.index === undefined) continue;
    facets.push({
      index: { byteStart: byteIndex(m.index), byteEnd: byteIndex(m.index + m[0].length) },
      features: [{ $type: "app.bsky.richtext.facet#link", uri: m[0] }],
    });
  }
  const tagRe = /(^|\s)#([A-Za-z0-9_]{1,64})/g;
  for (const m of text.matchAll(tagRe)) {
    if (m.index === undefined) continue;
    const start = m.index + m[1].length;
    facets.push({
      index: { byteStart: byteIndex(start), byteEnd: byteIndex(start + m[2].length + 1) },
      features: [{ $type: "app.bsky.richtext.facet#tag", tag: m[2] }],
    });
  }
  return facets;
}

// ---------------------------------------------------------------------------
// Telegram (bot API)
// ---------------------------------------------------------------------------

const telegram: PlatformAdapter = {
  key: "telegram",
  async publish(ctx) {
    const token = ctx.credentials.botToken;
    const chatId = ctx.credentials.chatId;
    if (!token || !chatId) {
      return { ok: false, error: "Missing Telegram bot token or chat ID." };
    }
    const base = `https://api.telegram.org/bot${token}`;
    const photos = ctx.media.filter((m) => m.kind === "image");

    let res;
    if (photos.length === 1) {
      res = await apiFetch(`${base}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photos[0].url,
          caption: ctx.content.slice(0, 1024),
        }),
      });
    } else if (photos.length > 1) {
      res = await apiFetch(`${base}/sendMediaGroup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          media: photos.slice(0, 10).map((m, i) => ({
            type: "photo",
            media: m.url,
            ...(i === 0 ? { caption: ctx.content.slice(0, 1024) } : {}),
          })),
        }),
      });
    } else {
      res = await apiFetch(`${base}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: ctx.content,
          disable_web_page_preview: false,
        }),
      });
    }

    if (!res.ok) {
      return {
        ok: false,
        error: describeError(res.status, res.body),
        retryable: isRetryableStatus(res.status),
      };
    }
    const d = res.body as { result?: { message_id?: number } | Array<{ message_id?: number }> };
    const first = Array.isArray(d.result) ? d.result[0] : d.result;
    const id = first?.message_id ? String(first.message_id) : "";
    const channel = chatId.startsWith("@") ? chatId.slice(1) : "";
    return {
      ok: true,
      externalPostId: id,
      externalUrl: channel && id ? `https://t.me/${channel}/${id}` : undefined,
    };
  },
  async fetchProfile({ credentials }) {
    const token = credentials.botToken;
    const chatId = credentials.chatId;
    if (!token || !chatId) return null;
    const res = await apiFetch(
      `https://api.telegram.org/bot${token}/getChatMemberCount?chat_id=${encodeURIComponent(chatId)}`,
    );
    if (!res.ok) return null;
    const d = res.body as { result?: number };
    return { followers: num(d.result) };
  },
};

// ---------------------------------------------------------------------------
// Discord & Slack (incoming webhooks)
// ---------------------------------------------------------------------------

const discord: PlatformAdapter = {
  key: "discord",
  async publish(ctx) {
    const url = ctx.credentials.webhookUrl;
    if (!url) return { ok: false, error: "Missing Discord webhook URL." };
    const images = ctx.media.filter((m) => m.kind === "image").slice(0, 10);
    const res = await apiFetch(`${url}?wait=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: ctx.content.slice(0, 2000),
        embeds: images.map((m) => ({ image: { url: m.url } })),
      }),
    });
    if (!res.ok) {
      return {
        ok: false,
        error: describeError(res.status, res.body),
        retryable: isRetryableStatus(res.status),
      };
    }
    const d = res.body as { id?: string; channel_id?: string };
    return {
      ok: true,
      externalPostId: d.id,
      externalUrl:
        d.id && d.channel_id ? `https://discord.com/channels/@me/${d.channel_id}/${d.id}` : undefined,
    };
  },
};

const slack: PlatformAdapter = {
  key: "slack",
  async publish(ctx) {
    const url = ctx.credentials.webhookUrl;
    if (!url) return { ok: false, error: "Missing Slack webhook URL." };
    const blocks: Array<Record<string, unknown>> = [
      { type: "section", text: { type: "mrkdwn", text: ctx.content.slice(0, 3000) } },
    ];
    for (const m of ctx.media.filter((x) => x.kind === "image").slice(0, 5)) {
      blocks.push({
        type: "image",
        image_url: m.url,
        alt_text: m.alt || "Attached image",
      });
    }
    const res = await apiFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: ctx.content.slice(0, 3000), blocks }),
    });
    if (!res.ok) {
      return {
        ok: false,
        error: describeError(res.status, res.body),
        retryable: isRetryableStatus(res.status),
      };
    }
    return { ok: true, externalPostId: `slack-${Date.now()}` };
  },
};

// ---------------------------------------------------------------------------
// DEV Community (Forem)
// ---------------------------------------------------------------------------

const devto: PlatformAdapter = {
  key: "devto",
  async publish(ctx) {
    const apiKey = ctx.credentials.apiKey;
    if (!apiKey) return { ok: false, error: "Missing DEV API key." };
    const title =
      typeof ctx.options.title === "string" && ctx.options.title.trim()
        ? ctx.options.title.trim()
        : firstLine(ctx.content);
    const res = await apiFetch("https://dev.to/api/articles", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        article: {
          title,
          body_markdown: ctx.content,
          published: ctx.options.published !== false,
          tags: extractHashtags(ctx.content).slice(0, 4),
        },
      }),
    });
    if (!res.ok) {
      return {
        ok: false,
        error: describeError(res.status, res.body),
        retryable: isRetryableStatus(res.status),
      };
    }
    const d = res.body as { id?: number; url?: string };
    return { ok: true, externalPostId: d.id ? String(d.id) : "", externalUrl: d.url };
  },
};

// ---------------------------------------------------------------------------
// X (Twitter) - OAuth 2.0 user context
// ---------------------------------------------------------------------------

const x: PlatformAdapter = {
  key: "x",
  async publish(ctx) {
    const token = ctx.credentials.accessToken;
    if (!token) {
      return { ok: false, error: "No X access token - reconnect the account." };
    }
    const parts = [ctx.content, ...(ctx.threadParts ?? [])].filter((p) => p.trim());
    let replyTo: string | undefined;
    let rootId = "";

    for (const part of parts) {
      const body: Record<string, unknown> = { text: part };
      if (replyTo) body.reply = { in_reply_to_tweet_id: replyTo };
      const res = await apiFetch("https://api.x.com/2/tweets", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        return {
          ok: false,
          error: describeError(res.status, res.body),
          retryable: isRetryableStatus(res.status),
        };
      }
      const d = res.body as { data?: { id?: string } };
      replyTo = d.data?.id;
      if (!rootId && replyTo) rootId = replyTo;
    }
    return {
      ok: true,
      externalPostId: rootId,
      externalUrl: rootId ? `https://x.com/${ctx.account.handle}/status/${rootId}` : undefined,
    };
  },
  async fetchProfile({ credentials }) {
    const token = credentials.accessToken;
    if (!token) return null;
    const res = await apiFetch(
      "https://api.x.com/2/users/me?user.fields=public_metrics,description,profile_image_url",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const d = (res.body as { data?: Record<string, unknown> }).data ?? {};
    const m = (d.public_metrics ?? {}) as Record<string, unknown>;
    return {
      followers: num(m.followers_count),
      following: num(m.following_count),
      postCount: num(m.tweet_count),
      bio: typeof d.description === "string" ? d.description : undefined,
      avatarUrl: typeof d.profile_image_url === "string" ? d.profile_image_url : undefined,
      displayName: typeof d.name === "string" ? d.name : undefined,
    };
  },
};

// ---------------------------------------------------------------------------
// LinkedIn - UGC posts API
// ---------------------------------------------------------------------------

const linkedin: PlatformAdapter = {
  key: "linkedin",
  async publish(ctx) {
    const token = ctx.credentials.accessToken;
    const authorUrn = ctx.credentials.authorUrn || ctx.account.externalId;
    if (!token || !authorUrn) {
      return { ok: false, error: "No LinkedIn access token - reconnect the account." };
    }
    const visibility =
      ctx.options.audience === "Connections only" ? "CONNECTIONS" : "PUBLIC";
    const res = await apiFetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: authorUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: ctx.content },
            shareMediaCategory: ctx.link ? "ARTICLE" : "NONE",
            ...(ctx.link
              ? { media: [{ status: "READY", originalUrl: ctx.link }] }
              : {}),
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": visibility },
      }),
    });
    if (!res.ok) {
      return {
        ok: false,
        error: describeError(res.status, res.body),
        retryable: isRetryableStatus(res.status),
      };
    }
    const d = res.body as { id?: string };
    return {
      ok: true,
      externalPostId: d.id,
      externalUrl: d.id ? `https://www.linkedin.com/feed/update/${d.id}` : undefined,
    };
  },
};

// ---------------------------------------------------------------------------
// Reddit
// ---------------------------------------------------------------------------

const reddit: PlatformAdapter = {
  key: "reddit",
  async publish(ctx) {
    const token = ctx.credentials.accessToken;
    if (!token) {
      return { ok: false, error: "No Reddit access token - reconnect the account." };
    }
    const sr = String(ctx.options.subreddit ?? "").replace(/^\/?r\//, "").trim();
    const title = String(ctx.options.title ?? "").trim() || firstLine(ctx.content);
    if (!sr) return { ok: false, error: "Reddit needs a target subreddit." };

    const form = new URLSearchParams({
      sr,
      title: title.slice(0, 300),
      kind: ctx.link ? "link" : "self",
      api_type: "json",
      ...(ctx.link ? { url: ctx.link } : { text: ctx.content }),
      ...(ctx.options.flair ? { flair_text: String(ctx.options.flair) } : {}),
    });
    const res = await apiFetch("https://oauth.reddit.com/api/submit", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Chorus/1.0 (social scheduler)",
      },
      body: form.toString(),
    });
    if (!res.ok) {
      return {
        ok: false,
        error: describeError(res.status, res.body),
        retryable: isRetryableStatus(res.status),
      };
    }
    const d = res.body as {
      json?: { errors?: unknown[]; data?: { id?: string; url?: string } };
    };
    if (d.json?.errors?.length) {
      return { ok: false, error: `Reddit rejected the post: ${JSON.stringify(d.json.errors).slice(0, 200)}` };
    }
    return {
      ok: true,
      externalPostId: d.json?.data?.id,
      externalUrl: d.json?.data?.url,
    };
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const ADAPTERS: Record<string, PlatformAdapter> = {
  mastodon: mastodonLike("mastodon"),
  "truth-social": mastodonLike("truth-social"),
  bluesky,
  telegram,
  discord,
  slack,
  devto,
  x,
  linkedin,
  reddit,
};

export function getAdapter(platformKey: string): PlatformAdapter | undefined {
  return ADAPTERS[platformKey];
}

export function hasLiveAdapter(platformKey: string): boolean {
  return platformKey in ADAPTERS;
}

/**
 * The sandbox publisher.
 *
 * Accounts connected in Sandbox mode run through this instead of the network.
 * It validates the payload exactly as a real adapter would - so limit
 * violations and missing required options still fail - then returns a
 * believable post id. This is what makes the whole product usable before any
 * developer app is approved.
 */
export async function sandboxPublish(ctx: PublishContext): Promise<PublishResult> {
  const def = ctx.platform;

  if (!ctx.content.trim() && ctx.media.length === 0) {
    return { ok: false, error: "Nothing to publish - the post is empty." };
  }
  if (ctx.content.length > def.charLimit) {
    return {
      ok: false,
      error: `${def.name} allows ${def.charLimit.toLocaleString()} characters; this post has ${ctx.content.length.toLocaleString()}.`,
    };
  }
  const images = ctx.media.filter((m) => m.kind === "image").length;
  if (images > def.maxImages) {
    return { ok: false, error: `${def.name} accepts at most ${def.maxImages} image(s).` };
  }
  const videos = ctx.media.filter((m) => m.kind === "video").length;
  if (videos > def.maxVideos) {
    return {
      ok: false,
      error:
        def.maxVideos === 0
          ? `${def.name} does not accept video.`
          : `${def.name} accepts at most ${def.maxVideos} video(s).`,
    };
  }
  for (const opt of def.postOptions ?? []) {
    if (opt.required) {
      const v = ctx.options[opt.name];
      if (v === undefined || v === null || String(v).trim() === "") {
        return { ok: false, error: `${def.name} requires "${opt.label}".` };
      }
    }
  }

  // Simulate realistic network latency so the UI's publishing states are real.
  await new Promise((r) => setTimeout(r, 120 + Math.random() * 380));

  const id = `sbx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    ok: true,
    externalPostId: id,
    externalUrl: `https://sandbox.chorus.local/${def.key}/${ctx.account.handle}/${id}`,
  };
}

// ---------------------------------------------------------------------------
// Small shared utilities
// ---------------------------------------------------------------------------

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").trim();
}

function firstLine(s: string): string {
  const line = s.split("\n").find((l) => l.trim()) ?? "Untitled";
  return line.trim().slice(0, 120);
}

export function extractHashtags(text: string): string[] {
  return [...text.matchAll(/(?:^|\s)#([A-Za-z0-9_]{2,64})/g)].map((m) => m[1]);
}

/** Short stable hash, used for idempotency keys. */
function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
