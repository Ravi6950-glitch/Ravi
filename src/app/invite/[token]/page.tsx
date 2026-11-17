import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getCurrentUser, createSession } from "@/lib/auth";
import { Wordmark } from "@/components/Logo";
import { Card, Icon, ICONS, Badge } from "@/components/ui";

export const metadata: Metadata = { title: "Join a workspace" };
export const dynamic = "force-dynamic";

/**
 * Accepting an invite.
 *
 * An invite is bound to an email address, so a signed-in user can only accept
 * one addressed to them - otherwise a leaked link would be a way into any
 * workspace.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: {
      workspace: { select: { id: true, name: true } },
      invitedBy: { select: { name: true } },
    },
  });

  const user = await getCurrentUser();

  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return (
      <Shell>
        <p className="flex items-center gap-2 text-[1.125rem] font-semibold">
          <Icon path={ICONS.alert} size={18} />
          This invite is no longer valid
        </p>
        <p className="mt-2 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
          {invite?.acceptedAt
            ? "It has already been used."
            : invite
              ? "It expired. Ask whoever invited you to send a new one."
              : "We could not find it. Check the link is complete."}
        </p>
        <Link href={user ? "/" : "/login"} className="btn btn-primary mt-5">
          {user ? "Back to Chorus" : "Sign in"}
        </Link>
      </Shell>
    );
  }

  // Not signed in: tell them what to do, do not silently create an account.
  if (!user) {
    return (
      <Shell>
        <Badge tone="brand">Invitation</Badge>
        <p className="mt-3 text-[1.25rem] font-bold tracking-[-0.02em]">
          Join {invite.workspace.name}
        </p>
        <p className="mt-2 text-[0.875rem] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {invite.invitedBy.name} invited <strong>{invite.email}</strong> to join as{" "}
          <strong>{invite.role.toLowerCase()}</strong>. Sign in with that address, or
          create an account using it, and then open this link again.
        </p>
        <div className="mt-5 flex gap-2">
          <Link href="/login" className="btn btn-primary">
            Sign in
          </Link>
          <Link href="/signup" className="btn">
            Create an account
          </Link>
        </div>
      </Shell>
    );
  }

  // Signed in as someone else.
  if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <Shell>
        <p className="flex items-center gap-2 text-[1.125rem] font-semibold">
          <Icon path={ICONS.alert} size={18} />
          This invite is for a different address
        </p>
        <p className="mt-2 text-[0.875rem] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          It was sent to <strong>{invite.email}</strong>, but you are signed in as{" "}
          <strong>{user.email}</strong>. Sign out and back in with the invited address.
        </p>
        <Link href="/" className="btn mt-5">
          Back to Chorus
        </Link>
      </Shell>
    );
  }

  // Already a member of this workspace.
  const existing = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: invite.workspaceId } },
  });
  if (existing) {
    await prisma.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
    redirect("/");
  }

  // Accept it.
  await prisma.membership.create({
    data: { userId: user.id, workspaceId: invite.workspaceId, role: invite.role },
  });
  await prisma.invite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  });
  await prisma.activityLog.create({
    data: {
      workspaceId: invite.workspaceId,
      userId: user.id,
      action: "member.added",
      detail: `${user.email} accepted an invite as ${invite.role}`,
    },
  });
  // Switch them into the workspace they just joined.
  await createSession({
    userId: user.id,
    email: user.email,
    workspaceId: invite.workspaceId,
  });

  redirect("/");
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-[440px]">
        <div className="mb-6 flex justify-center">
          <Wordmark />
        </div>
        <Card>{children}</Card>
      </div>
    </div>
  );
}
