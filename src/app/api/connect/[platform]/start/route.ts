import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser, can } from "@/lib/auth";
import { buildAuthorizeUrl } from "@/lib/platforms/oauth";
import { getPlatform } from "@/lib/platforms/registry";

/**
 * Starts an OAuth flow.
 *
 * The state token and PKCE verifier go into short-lived httpOnly cookies. The
 * callback compares the state it receives against the cookie, which is what
 * stops an attacker from completing a flow they started and attaching their
 * own social account to someone else's workspace.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", process.env.APP_URL ?? "http://localhost:3000"));
  }
  if (!can(user.role, "manageAccounts")) {
    return redirectToAccounts("Your role cannot connect accounts.");
  }
  if (!getPlatform(platform)) {
    return redirectToAccounts("Unknown platform.");
  }

  const built = buildAuthorizeUrl(platform);
  if (!built) {
    return redirectToAccounts(
      `${platform} has no OAuth credentials configured. Connect it in sandbox mode, or add its client id and secret to the environment.`,
    );
  }

  const jar = await cookies();
  const opts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600, // ten minutes is plenty to approve a consent screen
  };
  jar.set(`chorus_oauth_state_${platform}`, built.state, opts);
  if (built.codeVerifier) {
    jar.set(`chorus_oauth_verifier_${platform}`, built.codeVerifier, opts);
  }

  return NextResponse.redirect(built.url);
}

function redirectToAccounts(message: string) {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const url = new URL("/accounts", base);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}
