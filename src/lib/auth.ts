import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./db";
import { hashPassword, verifyPassword } from "./crypto";

/**
 * Session handling.
 *
 * A signed JWT in an httpOnly, SameSite=Lax cookie. httpOnly keeps it away
 * from any script on the page, so an XSS bug cannot read the session; SameSite
 * blocks the cookie from riding along on cross-site form posts.
 */

const COOKIE = "chorus_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Set it in .env (openssl rand -base64 48).",
    );
  }
  return new TextEncoder().encode(s);
}

export interface SessionPayload {
  userId: string;
  email: string;
  workspaceId: string;
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function readSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (
      typeof payload.userId === "string" &&
      typeof payload.email === "string" &&
      typeof payload.workspaceId === "string"
    ) {
      return {
        userId: payload.userId,
        email: payload.email,
        workspaceId: payload.workspaceId,
      };
    }
    return null;
  } catch {
    // Expired or tampered-with token - treat as signed out.
    return null;
  }
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  avatarColor: string;
  timezone: string;
  jobTitle: string | null;
  role: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
    brandVoice: string;
    brandColor: string;
    timezone: string;
    weekStart: number;
    plan: string;
  };
  /** Every workspace this person belongs to, for the switcher. */
  workspaces: Array<{ id: string; name: string; slug: string; role: string }>;
}

/** Resolves the signed-in user, or null. Safe to call from any server component. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await readSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { memberships: { include: { workspace: true } } },
  });
  if (!user || user.memberships.length === 0) return null;

  // Fall back to the first workspace if the cookie points at one the user has
  // since been removed from.
  const membership =
    user.memberships.find((m) => m.workspaceId === session.workspaceId) ??
    user.memberships[0];

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarColor: user.avatarColor,
    timezone: user.timezone,
    jobTitle: user.jobTitle,
    role: membership.role,
    workspace: {
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      brandVoice: membership.workspace.brandVoice,
      brandColor: membership.workspace.brandColor,
      timezone: membership.workspace.timezone,
      weekStart: membership.workspace.weekStart,
      plan: membership.workspace.plan,
    },
    workspaces: user.memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
    })),
  };
}

/** Like getCurrentUser, but redirects to /login when signed out. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export const ROLES = ["OWNER", "ADMIN", "EDITOR", "CONTRIBUTOR", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

const RANK: Record<string, number> = {
  OWNER: 50,
  ADMIN: 40,
  EDITOR: 30,
  CONTRIBUTOR: 20,
  VIEWER: 10,
};

export function roleAtLeast(role: string, minimum: Role): boolean {
  return (RANK[role] ?? 0) >= RANK[minimum];
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER: "Full control, including billing and deleting the workspace.",
  ADMIN: "Everything except deleting the workspace. Can manage people and connections.",
  EDITOR: "Create, schedule and publish posts. Can run AI agents.",
  CONTRIBUTOR: "Draft posts and submit them for approval. Cannot publish.",
  VIEWER: "Read-only access to the calendar, analytics and insights.",
};

export function can(role: string, action: "publish" | "manageAccounts" | "manageTeam" | "runAgents" | "edit"): boolean {
  switch (action) {
    case "manageTeam":
    case "manageAccounts":
      return roleAtLeast(role, "ADMIN");
    case "publish":
      return roleAtLeast(role, "EDITOR");
    case "runAgents":
      return roleAtLeast(role, "EDITOR");
    case "edit":
      return roleAtLeast(role, "CONTRIBUTOR");
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Sign up / sign in
// ---------------------------------------------------------------------------

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "workspace"
  );
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const existing = await prisma.workspace.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

const AVATAR_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#0ea5e9",
  "#3b82f6",
];

export interface AuthResult {
  ok: boolean;
  error?: string;
  userId?: string;
}

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
  workspaceName?: string;
  timezone?: string;
}): Promise<AuthResult> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (name.length < 2) return { ok: false, error: "Please enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "That email address does not look right." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Use at least 8 characters for your password." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "An account with that email already exists." };
  }

  const workspaceName = (input.workspaceName || `${name.split(" ")[0]}'s workspace`).trim();
  const slug = await uniqueSlug(workspaceName);
  const timezone = input.timezone || "UTC";

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: hashPassword(password),
      timezone,
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      memberships: {
        create: {
          role: "OWNER",
          workspace: {
            create: {
              name: workspaceName,
              slug,
              timezone,
              // A sensible default posting schedule: weekday mornings and
              // early afternoons, which is where most audiences are active.
              queueSlots: {
                create: [1, 2, 3, 4, 5].flatMap((day) => [
                  { dayOfWeek: day, hour: 9, minute: 0 },
                  { dayOfWeek: day, hour: 13, minute: 30 },
                  { dayOfWeek: day, hour: 17, minute: 0 },
                ]),
              },
            },
          },
        },
      },
    },
    include: { memberships: true },
  });

  const workspaceId = user.memberships[0].workspaceId;

  // Turn the automation agents on by default - the product is meant to work
  // for you in the background from the first minute.
  await seedDefaultAutomation(workspaceId);

  await prisma.activityLog.create({
    data: {
      workspaceId,
      userId: user.id,
      action: "workspace.created",
      entityType: "workspace",
      entityId: workspaceId,
      detail: workspaceName,
    },
  });

  await createSession({ userId: user.id, email: user.email, workspaceId });
  return { ok: true, userId: user.id };
}

export async function signIn(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: true },
  });

  // Same message whether the address is unknown or the password is wrong, so
  // the form cannot be used to discover which emails have accounts.
  const generic = { ok: false as const, error: "Email or password is incorrect." };
  if (!user) return generic;
  if (!verifyPassword(input.password, user.passwordHash)) return generic;
  if (user.memberships.length === 0) {
    return { ok: false, error: "This account has no workspace. Contact your admin." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await createSession({
    userId: user.id,
    email: user.email,
    workspaceId: user.memberships[0].workspaceId,
  });
  return { ok: true, userId: user.id };
}

/** Enables the standard set of background agents for a new workspace. */
export async function seedDefaultAutomation(workspaceId: string): Promise<void> {
  const defaults = [
    { agent: "performance-analyst", name: "Daily performance review", intervalMinutes: 720 },
    { agent: "profile-auditor", name: "Profile health audit", intervalMinutes: 1440 },
    { agent: "timing-oracle", name: "Best-time recalculation", intervalMinutes: 360 },
    { agent: "queue-optimizer", name: "Queue optimisation", intervalMinutes: 480 },
    { agent: "trend-scout", name: "Trend and idea scouting", intervalMinutes: 720 },
  ];
  const now = Date.now();
  for (const d of defaults) {
    await prisma.automationRule.upsert({
      where: { workspaceId_agent: { workspaceId, agent: d.agent } },
      update: {},
      create: {
        workspaceId,
        agent: d.agent,
        name: d.name,
        enabled: true,
        intervalMinutes: d.intervalMinutes,
        // Stagger first runs so a new workspace does not fire everything at once.
        nextRunAt: new Date(now + 60_000 + defaults.indexOf(d) * 45_000),
      },
    });
  }
}
