import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  PLATFORMS,
  platformOrFallback,
  platformsByCategory,
} from "@/lib/platforms/registry";
import { connectMode } from "@/lib/platforms/oauth";
import { hasLiveAdapter } from "@/lib/platforms/adapters";
import {
  Badge,
  Card,
  Icon,
  ICONS,
  PlatformAvatar,
  SectionHeader,
  StatusDot,
  formatNumber,
  formatRelative,
} from "@/components/ui";
import { ScoreRing } from "@/components/charts";
import { disconnectAccountAction, syncAccountAction } from "../actions";
import { ConnectPanel } from "./ConnectPanel";

export const metadata: Metadata = { title: "Connections" };
export const dynamic = "force-dynamic";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ connect?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const workspaceId = user.workspace.id;
  const canManage = ["OWNER", "ADMIN"].includes(user.role);

  const [accounts, audits] = await Promise.all([
    prisma.socialAccount.findMany({
      where: { workspaceId },
      orderBy: [{ platform: "asc" }, { handle: "asc" }],
    }),
    prisma.profileAudit.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      distinct: ["accountId"],
    }),
  ]);

  const connectedKeys = new Set(accounts.map((a) => a.platform));
  const groups = platformsByCategory();

  // Resolve how each platform can be connected right now, on the server -
  // this depends on which env credentials are present.
  const modes = Object.fromEntries(
    PLATFORMS.map((p) => [p.key, connectMode(p.key)]),
  ) as Record<string, "oauth" | "token" | "sandbox">;

  const selected = params.connect ? platformOrFallback(params.connect) : null;
  const liveCount = accounts.filter((a) => a.connection !== "SANDBOX").length;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.5rem] font-bold tracking-[-0.02em]">Connections</h1>
          <p className="mt-0.5 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            {accounts.length} connected · {liveCount} live ·{" "}
            {accounts.length - liveCount} sandbox · {PLATFORMS.length} networks supported
          </p>
        </div>
      </header>

      {/* ---------------------------------------------- connect a platform */}
      {selected && canManage ? (
        <ConnectPanel
          platform={{
            key: selected.key,
            name: selected.name,
            color: selected.color,
            auth: selected.auth,
            connectFields: selected.connectFields ?? [],
            docsUrl: selected.docsUrl,
            notes: selected.notes,
            charLimit: selected.charLimit,
            maxImages: selected.maxImages,
            maxHashtags: selected.maxHashtags,
          }}
          mode={modes[selected.key] ?? "sandbox"}
          hasLiveAdapter={hasLiveAdapter(selected.key)}
        />
      ) : null}

      {/* ------------------------------------------------ connected accounts */}
      {accounts.length > 0 ? (
        <Card padded={false}>
          <div className="p-5 pb-3">
            <SectionHeader
              title="Your accounts"
              subtitle="Everything Chorus can publish to and measure"
              icon={ICONS.link}
            />
          </div>
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {accounts.map((a) => {
              const def = platformOrFallback(a.platform);
              const audit = audits.find((x) => x.accountId === a.id);
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                  <PlatformAvatar platform={a.platform} size={40} handle={a.handle} />

                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[0.9375rem] font-semibold">
                        @{a.handle}
                      </span>
                      <span className="flex items-center gap-1 text-[0.75rem]">
                        <StatusDot status={a.status} />
                        <span style={{ color: "var(--text-muted)" }}>{def.name}</span>
                      </span>
                      {a.connection === "SANDBOX" ? (
                        <Badge tone="info">Sandbox</Badge>
                      ) : (
                        <Badge tone="good">Live</Badge>
                      )}
                      {a.status !== "CONNECTED" ? (
                        <Badge tone="bad">{a.status}</Badge>
                      ) : null}
                    </p>
                    <p
                      className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[0.75rem]"
                      style={{ color: "var(--text-faint)" }}
                    >
                      <span>
                        <strong className="tabular-nums">{formatNumber(a.followers)}</strong>{" "}
                        followers
                      </span>
                      <span>
                        <strong className="tabular-nums">{a.postCount}</strong> posts sent
                      </span>
                      {a.lastSyncedAt ? (
                        <span>synced {formatRelative(a.lastSyncedAt)}</span>
                      ) : null}
                      {audit ? <span>profile grade {audit.grade}</span> : null}
                    </p>
                    {a.lastError ? (
                      <p
                        className="mt-1.5 flex items-start gap-1.5 text-[0.75rem]"
                        style={{ color: "var(--bad)" }}
                      >
                        <Icon path={ICONS.alert} size={13} className="mt-[1px] shrink-0" />
                        {a.lastError}
                      </p>
                    ) : null}
                  </div>

                  {audit ? (
                    <Link href="/insights" title="Latest profile audit">
                      <ScoreRing score={audit.score} size={46} label={`@${a.handle} profile`} />
                    </Link>
                  ) : null}

                  <div className="flex shrink-0 gap-1.5">
                    <Link
                      href={`/analytics?account=${a.id}`}
                      className="btn btn-sm"
                      title="Analytics for this account"
                    >
                      <Icon path={ICONS.chart} size={13} />
                    </Link>
                    <form action={syncAccountAction}>
                      <input type="hidden" name="accountId" value={a.id} />
                      <button type="submit" className="btn btn-sm" title="Sync now">
                        <Icon path={ICONS.refresh} size={13} />
                      </button>
                    </form>
                    {canManage ? (
                      <form action={disconnectAccountAction}>
                        <input type="hidden" name="accountId" value={a.id} />
                        <button
                          type="submit"
                          className="btn btn-danger btn-sm"
                          title="Disconnect"
                        >
                          <Icon path={ICONS.trash} size={13} />
                        </button>
                      </form>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {/* ------------------------------------------------ platform catalogue */}
      <Card>
        <SectionHeader
          title="Add a network"
          subtitle={
            canManage
              ? "Pick any network. Those without developer credentials configured can still be connected in sandbox mode, so you can build and test the full workflow."
              : "Only owners and admins can connect accounts."
          }
          icon={ICONS.plus}
        />

        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <div key={group.category}>
              <p
                className="mb-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em]"
                style={{ color: "var(--text-faint)" }}
              >
                {group.label}{" "}
                <span style={{ fontWeight: 400 }}>({group.platforms.length})</span>
              </p>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {group.platforms.map((p) => {
                  const mode = modes[p.key] ?? "sandbox";
                  const already = connectedKeys.has(p.key);
                  return (
                    <li key={p.key}>
                      <Link
                        href={canManage ? `/accounts?connect=${p.key}` : "/accounts"}
                        aria-disabled={!canManage}
                        className="card card-hover flex h-full flex-col gap-2 p-3"
                        style={{
                          background:
                            selected?.key === p.key ? "var(--brand-soft)" : "var(--bg-elevated)",
                          pointerEvents: canManage ? undefined : "none",
                          opacity: canManage ? 1 : 0.6,
                        }}
                      >
                        <span className="flex items-center gap-2">
                          <PlatformAvatar platform={p.key} size={28} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[0.8125rem] font-semibold">
                              {p.name}
                            </span>
                            <span
                              className="block text-[0.625rem]"
                              style={{ color: "var(--text-faint)" }}
                            >
                              {p.charLimit.toLocaleString()} chars
                              {p.maxHashtags > 0 ? ` · ${p.maxHashtags} tags` : ""}
                            </span>
                          </span>
                        </span>
                        <span className="mt-auto flex flex-wrap gap-1">
                          {already ? <Badge tone="good">Connected</Badge> : null}
                          {mode === "oauth" ? (
                            <Badge tone="brand">OAuth ready</Badge>
                          ) : mode === "token" ? (
                            <Badge tone="info">
                              {p.auth === "webhook" ? "Webhook" : "Token"}
                            </Badge>
                          ) : (
                            <Badge>Sandbox</Badge>
                          )}
                          {hasLiveAdapter(p.key) ? (
                            <Badge tone="good">Live publisher</Badge>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {/* --------------------------------------------------- how this works */}
      <Card>
        <SectionHeader title="How connecting works" icon={ICONS.info} />
        <div className="grid grid-cols-1 gap-4 text-[0.8125rem] leading-relaxed sm:grid-cols-3">
          <div>
            <p className="mb-1 flex items-center gap-1.5 font-semibold">
              <Badge tone="info">Token</Badge>
            </p>
            <p style={{ color: "var(--text-muted)" }}>
              Mastodon, Bluesky, Telegram, Discord, Slack, DEV and a few others need
              nothing but a token or app password you create yourself. These publish
              for real the moment you connect them - no app review, no waiting.
            </p>
          </div>
          <div>
            <p className="mb-1 flex items-center gap-1.5 font-semibold">
              <Badge tone="brand">OAuth</Badge>
            </p>
            <p style={{ color: "var(--text-muted)" }}>
              Instagram, X, LinkedIn, TikTok, YouTube, Reddit and the rest require a
              reviewed developer app. Add that platform&apos;s client id and secret to
              your environment and the OAuth button appears here.
            </p>
          </div>
          <div>
            <p className="mb-1 flex items-center gap-1.5 font-semibold">
              <Badge>Sandbox</Badge>
            </p>
            <p style={{ color: "var(--text-muted)" }}>
              Every network can be connected in sandbox mode. Posts run through the
              same validation and scheduling path and are marked clearly as sandbox -
              so you can build your whole operation before a single app is approved.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
