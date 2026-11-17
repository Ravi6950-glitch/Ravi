import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Sidebar, type NavCounts } from "@/components/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const workspaceId = user.workspace.id;

  // The counts behind the sidebar badges, in one round trip.
  const [queued, needsApproval, unreadInsights, accounts] = await Promise.all([
    prisma.post.count({
      where: { workspaceId, status: { in: ["SCHEDULED", "QUEUED"] } },
    }),
    prisma.post.count({ where: { workspaceId, status: "NEEDS_APPROVAL" } }),
    prisma.insight.count({ where: { workspaceId, readAt: null } }),
    prisma.socialAccount.count({ where: { workspaceId } }),
  ]);

  const counts: NavCounts = { queued, needsApproval, unreadInsights, accounts };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar
        user={{
          name: user.name,
          email: user.email,
          avatarColor: user.avatarColor,
          role: user.role,
          workspace: { name: user.workspace.name, plan: user.workspace.plan },
        }}
        counts={counts}
      />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 sm:py-7">
          {children}
        </div>
      </main>
    </div>
  );
}
