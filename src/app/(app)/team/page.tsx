import type { Metadata } from "next";
import { requireUser, ROLE_DESCRIPTIONS, type Role } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  Badge,
  Card,
  Icon,
  ICONS,
  SectionHeader,
  formatDate,
  formatRelative,
} from "@/components/ui";
import {
  changeRoleAction,
  removeMemberAction,
  revokeInviteAction,
} from "../actions";
import { InviteForm } from "./InviteForm";

export const metadata: Metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const user = await requireUser();
  const workspaceId = user.workspace.id;
  const canManage = ["OWNER", "ADMIN"].includes(user.role);

  const [memberships, invites, activity] = await Promise.all([
    prisma.membership.findMany({
      where: { workspaceId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invite.findMany({
      where: { workspaceId, acceptedAt: null },
      include: { invitedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.activityLog.findMany({
      where: { workspaceId },
      include: { user: { select: { name: true, avatarColor: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  const roleOrder = ["OWNER", "ADMIN", "EDITOR", "CONTRIBUTOR", "VIEWER"];
  const sorted = [...memberships].sort(
    (a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role),
  );

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-[1.5rem] font-bold tracking-[-0.02em]">Team</h1>
        <p className="mt-0.5 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
          {memberships.length} member{memberships.length === 1 ? "" : "s"} of{" "}
          {user.workspace.name}
          {invites.length > 0 ? ` · ${invites.length} invite pending` : ""}
        </p>
      </header>

      {canManage ? <InviteForm /> : null}

      {/* Members */}
      <Card padded={false}>
        <div className="p-5 pb-3">
          <SectionHeader title="Members" icon={ICONS.users} />
        </div>
        <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
          {sorted.map((m) => {
            const isSelf = m.userId === user.id;
            const ownerCount = memberships.filter((x) => x.role === "OWNER").length;
            const lastOwner = m.role === "OWNER" && ownerCount <= 1;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[0.8125rem] font-bold text-white"
                  style={{ background: m.user.avatarColor }}
                  aria-hidden="true"
                >
                  {initials(m.user.name)}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[0.9375rem] font-semibold">
                      {m.user.name}
                    </span>
                    {isSelf ? <Badge tone="brand">You</Badge> : null}
                    <Badge tone={m.role === "OWNER" ? "good" : "neutral"}>{m.role}</Badge>
                  </p>
                  <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                    {m.user.email}
                    {m.user.jobTitle ? ` · ${m.user.jobTitle}` : ""}
                    {" · joined "}
                    {formatDate(m.createdAt)}
                    {m.user.lastLoginAt
                      ? ` · last seen ${formatRelative(m.user.lastLoginAt)}`
                      : " · never signed in"}
                  </p>
                </div>

                {canManage ? (
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <form action={changeRoleAction} className="flex items-center gap-1.5">
                      <input type="hidden" name="membershipId" value={m.id} />
                      <label className="sr-only" htmlFor={`role-${m.id}`}>
                        Role for {m.user.name}
                      </label>
                      <select
                        id={`role-${m.id}`}
                        name="role"
                        defaultValue={m.role}
                        className="select btn-sm"
                        style={{ minWidth: 128 }}
                        disabled={lastOwner}
                      >
                        {roleOrder.map((r) => (
                          <option
                            key={r}
                            value={r}
                            disabled={r === "OWNER" && user.role !== "OWNER"}
                          >
                            {r}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="btn btn-sm" disabled={lastOwner}>
                        Save
                      </button>
                    </form>
                    {!isSelf && !lastOwner ? (
                      <form action={removeMemberAction}>
                        <input type="hidden" name="membershipId" value={m.id} />
                        <button
                          type="submit"
                          className="btn btn-danger btn-sm"
                          title={`Remove ${m.user.name}`}
                        >
                          <Icon path={ICONS.trash} size={13} />
                        </button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Pending invites */}
      {invites.length > 0 ? (
        <Card padded={false}>
          <div className="p-5 pb-3">
            <SectionHeader
              title="Pending invites"
              subtitle="Share the link with each person. Invites expire after 14 days."
              icon={ICONS.send}
            />
          </div>
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {invites.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[0.875rem] font-medium">
                    {inv.email}
                    <Badge>{inv.role}</Badge>
                  </p>
                  <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                    invited by {inv.invitedBy.name} · expires{" "}
                    {formatRelative(inv.expiresAt)}
                  </p>
                  <code
                    className="mt-1 block overflow-x-auto rounded px-2 py-1 text-[0.6875rem]"
                    style={{ background: "var(--bg)", color: "var(--text-muted)" }}
                  >
                    /invite/{inv.token}
                  </code>
                </div>
                {canManage ? (
                  <form action={revokeInviteAction}>
                    <input type="hidden" name="inviteId" value={inv.id} />
                    <button type="submit" className="btn btn-danger btn-sm">
                      <Icon path={ICONS.x} size={13} />
                      Revoke
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* What each role can do */}
      <Card>
        <SectionHeader
          title="What each role can do"
          subtitle="Permissions are enforced on the server, not just hidden in the interface."
          icon={ICONS.shield}
        />
        <ul className="flex flex-col gap-2.5">
          {(Object.keys(ROLE_DESCRIPTIONS) as Role[]).map((role) => (
            <li key={role} className="flex flex-wrap items-start gap-3">
              <span className="w-[112px] shrink-0">
                <Badge tone={role === "OWNER" ? "good" : "neutral"}>{role}</Badge>
              </span>
              <span
                className="min-w-0 flex-1 text-[0.8125rem] leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                {ROLE_DESCRIPTIONS[role]}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Activity */}
      <Card padded={false}>
        <div className="p-5 pb-3">
          <SectionHeader
            title="Activity"
            subtitle="Everything that happened in this workspace"
            icon={ICONS.clock}
          />
        </div>
        <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
          {activity.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-5 py-2.5">
              {a.user ? (
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-bold text-white"
                  style={{ background: a.user.avatarColor }}
                  aria-hidden="true"
                >
                  {initials(a.user.name)}
                </span>
              ) : (
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  style={{ background: "var(--bg-elevated)", color: "var(--text-faint)" }}
                >
                  <Icon path={ICONS.agent} size={12} />
                </span>
              )}
              <span className="min-w-0 flex-1 text-[0.8125rem]">
                <strong className="font-medium">{a.user?.name ?? "Chorus"}</strong>{" "}
                <span style={{ color: "var(--text-muted)" }}>
                  {humanAction(a.action)}
                  {a.detail ? ` - ${a.detail}` : ""}
                </span>
              </span>
              <span
                className="shrink-0 text-[0.6875rem] whitespace-nowrap"
                style={{ color: "var(--text-faint)" }}
              >
                {formatRelative(a.createdAt)}
              </span>
            </li>
          ))}
          {activity.length === 0 ? (
            <li className="px-5 py-6 text-center text-[0.8125rem]" style={{ color: "var(--text-faint)" }}>
              Nothing yet.
            </li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function humanAction(action: string): string {
  const map: Record<string, string> = {
    "workspace.created": "created the workspace",
    "account.connected": "connected an account",
    "account.reconnected": "reconnected an account",
    "account.disconnected": "disconnected an account",
    "post.draft": "saved a draft",
    "post.queue": "added a post to the queue",
    "post.schedule": "scheduled a post",
    "post.now": "published a post",
    "post.published": "published a post",
    "post.partial": "partly published a post",
    "post.failed": "had a post fail",
    "post.deleted": "deleted a post",
    "post.approved": "approved a post",
    "post.rescheduled": "rescheduled a post",
    "member.invited": "invited someone",
    "member.added": "added someone",
    "member.removed": "removed someone",
    "member.role_changed": "changed a role",
    "user.password_changed": "changed their password",
    "queue.slots_applied": "applied recommended posting slots",
  };
  return map[action] ?? action.replace(/[._]/g, " ");
}
