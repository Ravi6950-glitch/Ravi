import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { platformOrFallback } from "@/lib/platforms/registry";
import { isAiConfigured } from "@/lib/agents/client";
import { Composer } from "./Composer";

export const metadata: Metadata = { title: "Composer" };
export const dynamic = "force-dynamic";

export default async function ComposerPage({
  searchParams,
}: {
  searchParams: Promise<{ idea?: string; post?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const workspaceId = user.workspace.id;

  const [accounts, media, slots, editing] = await Promise.all([
    prisma.socialAccount.findMany({
      where: { workspaceId },
      orderBy: [{ platform: "asc" }, { handle: "asc" }],
    }),
    prisma.mediaAsset.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 24,
    }),
    prisma.queueSlot.findMany({
      where: { workspaceId, enabled: true },
      orderBy: [{ dayOfWeek: "asc" }, { hour: "asc" }],
    }),
    params.post
      ? prisma.post.findFirst({
          where: { id: params.post, workspaceId },
          include: { targets: true, media: true },
        })
      : null,
  ]);

  return (
    <Composer
      accounts={accounts.map((a) => ({
        id: a.id,
        platform: a.platform,
        platformName: platformOrFallback(a.platform).name,
        handle: a.handle,
        displayName: a.displayName,
        status: a.status,
        connection: a.connection,
        followers: a.followers,
      }))}
      media={media.map((m) => ({
        id: m.id,
        url: m.url,
        kind: m.kind,
        alt: m.alt,
      }))}
      queueSlotCount={slots.length}
      brandVoice={user.workspace.brandVoice}
      canPublish={["OWNER", "ADMIN", "EDITOR"].includes(user.role)}
      aiEnabled={isAiConfigured()}
      initialIdea={params.idea ?? ""}
      editing={
        editing
          ? {
              id: editing.id,
              baseContent: editing.baseContent,
              title: editing.title,
              link: editing.link,
              firstComment: editing.firstComment,
              status: editing.status,
              scheduledAt: editing.scheduledAt?.toISOString() ?? null,
              accountIds: editing.targets.map((t) => t.accountId),
              mediaIds: editing.media.map((m) => m.mediaId),
              overrides: Object.fromEntries(
                editing.targets
                  .filter((t) => t.content)
                  .map((t) => [t.accountId, t.content as string]),
              ),
            }
          : null
      }
    />
  );
}
