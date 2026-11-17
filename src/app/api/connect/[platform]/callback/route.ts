import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getCurrentUser, can } from "@/lib/auth";
import { encryptJson, encryptSecret } from "@/lib/crypto";
import { exchangeCodeForToken } from "@/lib/platforms/oauth";
import { getPlatform } from "@/lib/platforms/registry";
import { getAdapter } from "@/lib/platforms/adapters";
import { syncAccountAnalytics } from "@/lib/worker/analytics";

/** Completes an OAuth flow and stores the encrypted token. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  const jar = await cookies();
  const expectedState = jar.get(`chorus_oauth_state_${platform}`)?.value;
  const verifier = jar.get(`chorus_oauth_verifier_${platform}`)?.value;

  // Clear the one-shot cookies whatever happens next.
  jar.delete(`chorus_oauth_state_${platform}`);
  jar.delete(`chorus_oauth_verifier_${platform}`);

  const user = await getCurrentUser();
  if (!user) return back("You were signed out before the connection finished.");
  if (!can(user.role, "manageAccounts")) return back("Your role cannot connect accounts.");

  const def = getPlatform(platform);
  if (!def) return back("Unknown platform.");
  if (providerError) return back(`${def.name} refused the connection: ${providerError}`);
  if (!code) return back(`${def.name} did not return an authorisation code.`);

  // The state check: without it, a link could silently graft an attacker's
  // account onto this workspace.
  if (!expectedState || !returnedState || expectedState !== returnedState) {
    return back(
      "The connection could not be verified. Start again from the Connections page.",
    );
  }

  let token;
  try {
    token = await exchangeCodeForToken(platform, code, verifier);
  } catch (err) {
    return back(err instanceof Error ? err.message : "Token exchange failed.");
  }

  // Ask the network who we just connected as, so the account is labelled
  // correctly rather than with a placeholder.
  let handle = `${platform}-account`;
  let displayName = def.name;
  let externalId: string | null = null;
  let followers = 0;
  let bio: string | null = null;
  let avatarUrl: string | null = null;

  const adapter = getAdapter(platform);
  if (adapter?.fetchProfile) {
    try {
      const profile = await adapter.fetchProfile({
        credentials: { accessToken: token.accessToken },
        account: {
          id: "pending",
          handle,
          displayName,
          externalId: null,
          connection: "OAUTH",
        },
      });
      if (profile) {
        displayName = profile.displayName ?? displayName;
        followers = profile.followers ?? 0;
        bio = profile.bio ?? null;
        avatarUrl = profile.avatarUrl ?? null;
      }
    } catch {
      // Not fatal - the worker will fill this in on its next sync.
    }
  }
  // Prefer an explicit handle hint from the provider response where present.
  const raw = token.raw as Record<string, unknown>;
  for (const key of ["screen_name", "username", "name", "login"]) {
    const v = raw[key];
    if (typeof v === "string" && v.trim()) {
      handle = v.trim().replace(/^@/, "");
      break;
    }
  }
  for (const key of ["id", "user_id", "sub", "open_id"]) {
    const v = raw[key];
    if (typeof v === "string" || typeof v === "number") {
      externalId = String(v);
      break;
    }
  }

  const existing = await prisma.socialAccount.findUnique({
    where: {
      workspaceId_platform_handle: { workspaceId: user.workspace.id, platform, handle },
    },
  });

  const data = {
    displayName,
    externalId,
    status: "CONNECTED",
    connection: "OAUTH",
    accessToken: encryptSecret(token.accessToken),
    refreshToken: token.refreshToken ? encryptSecret(token.refreshToken) : null,
    tokenExpiresAt: token.expiresInSeconds
      ? new Date(Date.now() + token.expiresInSeconds * 1000)
      : null,
    scopes: token.scope ?? null,
    config: encryptJson({ authorUrn: externalId ? `urn:li:person:${externalId}` : "" }),
    followers,
    bio,
    avatarUrl,
    lastSyncedAt: new Date(),
    lastError: null,
    lastErrorAt: null,
  };

  const account = existing
    ? await prisma.socialAccount.update({ where: { id: existing.id }, data })
    : await prisma.socialAccount.create({
        data: { workspaceId: user.workspace.id, platform, handle, ...data },
      });

  await prisma.activityLog.create({
    data: {
      workspaceId: user.workspace.id,
      userId: user.id,
      action: existing ? "account.reconnected" : "account.connected",
      entityType: "account",
      entityId: account.id,
      detail: `${def.name} @${handle} via OAuth`,
    },
  });

  await syncAccountAnalytics(account.id).catch(() => {
    /* the worker will retry */
  });

  const base = process.env.APP_URL ?? "http://localhost:3000";
  const done = new URL("/accounts", base);
  done.searchParams.set("connected", `${def.name} @${handle}`);
  return NextResponse.redirect(done);
}

function back(message: string) {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const url = new URL("/accounts", base);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}
