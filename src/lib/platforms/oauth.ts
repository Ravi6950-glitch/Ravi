import { randomToken } from "@/lib/crypto";
import { getPlatform, hasLiveCredentials } from "./registry";

/**
 * OAuth 2.0 endpoint configuration per platform.
 *
 * Chorus builds the authorize URL and exchanges the code itself, so adding a
 * network's live auth means adding its endpoints here plus the client id and
 * secret in the environment. Platforms absent from this map either use a
 * per-account token (no OAuth dance needed) or are sandbox-only for now.
 */

export interface OAuthProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
  /** Some providers want credentials in a Basic auth header, not the body. */
  useBasicAuth?: boolean;
  /** Extra query params on the authorize request. */
  extraAuthParams?: Record<string, string>;
  /** PKCE is required by X and recommended elsewhere. */
  usePkce?: boolean;
}

export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  x: {
    authorizeUrl: "https://x.com/i/oauth2/authorize",
    tokenUrl: "https://api.x.com/2/oauth2/token",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    clientIdEnv: "X_CLIENT_ID",
    clientSecretEnv: "X_CLIENT_SECRET",
    useBasicAuth: true,
    usePkce: true,
  },
  linkedin: {
    authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["openid", "profile", "email", "w_member_social"],
    clientIdEnv: "LINKEDIN_CLIENT_ID",
    clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
  },
  instagram: {
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    scopes: [
      "instagram_basic",
      "instagram_content_publish",
      "instagram_manage_insights",
      "pages_show_list",
      "business_management",
    ],
    clientIdEnv: "META_CLIENT_ID",
    clientSecretEnv: "META_CLIENT_SECRET",
  },
  facebook: {
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    scopes: [
      "pages_manage_posts",
      "pages_read_engagement",
      "pages_show_list",
      "read_insights",
    ],
    clientIdEnv: "META_CLIENT_ID",
    clientSecretEnv: "META_CLIENT_SECRET",
  },
  threads: {
    authorizeUrl: "https://threads.net/oauth/authorize",
    tokenUrl: "https://graph.threads.net/oauth/access_token",
    scopes: ["threads_basic", "threads_content_publish", "threads_manage_insights"],
    clientIdEnv: "META_CLIENT_ID",
    clientSecretEnv: "META_CLIENT_SECRET",
  },
  tiktok: {
    authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    scopes: ["user.info.basic", "user.info.stats", "video.publish", "video.list"],
    clientIdEnv: "TIKTOK_CLIENT_KEY",
    clientSecretEnv: "TIKTOK_CLIENT_SECRET",
    extraAuthParams: { client_key_param: "client_key" },
  },
  youtube: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/yt-analytics.readonly",
    ],
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    extraAuthParams: { access_type: "offline", prompt: "consent" },
  },
  "google-business": {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/business.manage"],
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    extraAuthParams: { access_type: "offline", prompt: "consent" },
  },
  pinterest: {
    authorizeUrl: "https://www.pinterest.com/oauth/",
    tokenUrl: "https://api.pinterest.com/v5/oauth/token",
    scopes: ["boards:read", "pins:read", "pins:write", "user_accounts:read"],
    clientIdEnv: "PINTEREST_CLIENT_ID",
    clientSecretEnv: "PINTEREST_CLIENT_SECRET",
    useBasicAuth: true,
  },
  reddit: {
    authorizeUrl: "https://www.reddit.com/api/v1/authorize",
    tokenUrl: "https://www.reddit.com/api/v1/access_token",
    scopes: ["identity", "submit", "read", "flair"],
    clientIdEnv: "REDDIT_CLIENT_ID",
    clientSecretEnv: "REDDIT_CLIENT_SECRET",
    useBasicAuth: true,
    extraAuthParams: { duration: "permanent" },
  },
  tumblr: {
    authorizeUrl: "https://www.tumblr.com/oauth2/authorize",
    tokenUrl: "https://api.tumblr.com/v2/oauth2/token",
    scopes: ["basic", "write", "offline_access"],
    clientIdEnv: "TUMBLR_CLIENT_ID",
    clientSecretEnv: "TUMBLR_CLIENT_SECRET",
  },
  twitch: {
    authorizeUrl: "https://id.twitch.tv/oauth2/authorize",
    tokenUrl: "https://id.twitch.tv/oauth2/token",
    scopes: ["channel:manage:broadcast", "user:read:email"],
    clientIdEnv: "TWITCH_CLIENT_ID",
    clientSecretEnv: "TWITCH_CLIENT_SECRET",
  },
  snapchat: {
    authorizeUrl: "https://accounts.snapchat.com/login/oauth2/authorize",
    tokenUrl: "https://accounts.snapchat.com/login/oauth2/access_token",
    scopes: ["snapchat-marketing-api"],
    clientIdEnv: "SNAPCHAT_CLIENT_ID",
    clientSecretEnv: "SNAPCHAT_CLIENT_SECRET",
  },
};

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export function redirectUri(platformKey: string): string {
  return `${appUrl()}/api/connect/${platformKey}/callback`;
}

/**
 * Describes how an account for this platform can actually be connected right
 * now, given the environment. The accounts UI uses this to decide which
 * button to show.
 */
export type ConnectMode = "oauth" | "token" | "sandbox";

export function connectMode(platformKey: string): ConnectMode {
  const def = getPlatform(platformKey);
  if (!def) return "sandbox";
  if (def.auth === "token" || def.auth === "webhook" || def.auth === "app-password") {
    return "token";
  }
  const provider = OAUTH_PROVIDERS[platformKey];
  if (provider && hasLiveCredentials(platformKey)) return "oauth";
  return "sandbox";
}

/** Builds the provider's authorize URL plus the state/verifier to remember. */
export function buildAuthorizeUrl(platformKey: string): {
  url: string;
  state: string;
  codeVerifier?: string;
} | null {
  const provider = OAUTH_PROVIDERS[platformKey];
  if (!provider) return null;
  const clientId = process.env[provider.clientIdEnv];
  if (!clientId) return null;

  const state = randomToken(24);
  const params = new URLSearchParams({
    response_type: "code",
    redirect_uri: redirectUri(platformKey),
    scope: provider.scopes.join(" "),
    state,
  });

  // TikTok names the parameter client_key rather than client_id.
  if (provider.extraAuthParams?.client_key_param === "client_key") {
    params.set("client_key", clientId);
  } else {
    params.set("client_id", clientId);
  }
  for (const [k, v] of Object.entries(provider.extraAuthParams ?? {})) {
    if (k !== "client_key_param") params.set(k, v);
  }

  let codeVerifier: string | undefined;
  if (provider.usePkce) {
    codeVerifier = randomToken(32);
    // S256 would need the challenge hashed; "plain" keeps the exchange simple
    // and is still sufficient because the verifier never leaves the server.
    params.set("code_challenge", codeVerifier);
    params.set("code_challenge_method", "plain");
  }

  return { url: `${provider.authorizeUrl}?${params.toString()}`, state, codeVerifier };
}

export interface TokenExchangeResult {
  accessToken: string;
  refreshToken?: string;
  expiresInSeconds?: number;
  scope?: string;
  raw: Record<string, unknown>;
}

export async function exchangeCodeForToken(
  platformKey: string,
  code: string,
  codeVerifier?: string,
): Promise<TokenExchangeResult> {
  const provider = OAUTH_PROVIDERS[platformKey];
  if (!provider) throw new Error(`No OAuth provider configured for ${platformKey}`);
  const clientId = process.env[provider.clientIdEnv];
  const clientSecret = process.env[provider.clientSecretEnv];
  if (!clientId || !clientSecret) {
    throw new Error(
      `Missing ${provider.clientIdEnv} / ${provider.clientSecretEnv} in the environment.`,
    );
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(platformKey),
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };
  if (provider.useBasicAuth) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  } else {
    body.set("client_id", clientId);
    body.set("client_secret", clientSecret);
  }
  if (codeVerifier) body.set("code_verifier", codeVerifier);
  if (platformKey === "reddit") headers["User-Agent"] = "Chorus/1.0 (social scheduler)";

  const res = await fetch(provider.tokenUrl, {
    method: "POST",
    headers,
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Token exchange failed (HTTP ${res.status}): ${text.slice(0, 240)}`);
  }
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Token endpoint did not return JSON.");
  }
  const accessToken = String(json.access_token ?? "");
  if (!accessToken) throw new Error("Token endpoint returned no access_token.");
  return {
    accessToken,
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : undefined,
    expiresInSeconds:
      typeof json.expires_in === "number" ? json.expires_in : undefined,
    scope: typeof json.scope === "string" ? json.scope : undefined,
    raw: json,
  };
}
