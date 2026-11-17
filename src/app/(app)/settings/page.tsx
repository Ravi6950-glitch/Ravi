import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAiConfigured, aiModel } from "@/lib/agents/client";
import { workerStatus } from "@/lib/worker/scheduler";
import { PLATFORMS } from "@/lib/platforms/registry";
import {
  Badge,
  Card,
  Icon,
  ICONS,
  SectionHeader,
  formatRelative,
  DAY_NAMES_FULL,
} from "@/components/ui";
import {
  addQueueSlotAction,
  applyRecommendedSlotsAction,
  deleteMediaAction,
  deleteQueueSlotAction,
} from "../actions";
import { ProfileForm, PasswordForm, WorkspaceForm, MediaForm } from "./Forms";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const workspaceId = user.workspace.id;
  const canManageWorkspace = ["OWNER", "ADMIN"].includes(user.role);
  const canPublish = ["OWNER", "ADMIN", "EDITOR"].includes(user.role);

  const [slots, media, bestTimeCount, rules] = await Promise.all([
    prisma.queueSlot.findMany({
      where: { workspaceId },
      orderBy: [{ dayOfWeek: "asc" }, { hour: "asc" }, { minute: "asc" }],
    }),
    prisma.mediaAsset.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.bestTime.count({ where: { account: { workspaceId } } }),
    prisma.automationRule.findMany({ where: { workspaceId } }),
  ]);

  const worker = workerStatus();
  const byDay = Array.from({ length: 7 }, (_, d) =>
    slots.filter((s) => s.dayOfWeek === d),
  );
  const liveAdapters = PLATFORMS.filter((p) => p.liveAdapter).length;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-[1.5rem] font-bold tracking-[-0.02em]">Settings</h1>
        <p className="mt-0.5 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
          Your profile, the workspace, and when Chorus publishes.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ProfileForm
          name={user.name}
          email={user.email}
          jobTitle={user.jobTitle ?? ""}
          timezone={user.timezone}
        />
        <PasswordForm />
      </div>

      <WorkspaceForm
        name={user.workspace.name}
        slug={user.workspace.slug}
        brandVoice={user.workspace.brandVoice}
        timezone={user.workspace.timezone}
        weekStart={user.workspace.weekStart}
        canManage={canManageWorkspace}
      />

      {/* ------------------------------------------------ posting schedule */}
      <Card>
        <SectionHeader
          title="Posting schedule"
          subtitle={`${slots.length} slot(s) a week. Anything you add to the queue drains into the next free one. Times are UTC.`}
          icon={ICONS.clock}
          action={
            canPublish && bestTimeCount > 0 ? (
              <form action={applyRecommendedSlotsAction}>
                <button type="submit" className="btn btn-sm">
                  <Icon path={ICONS.sparkle} size={13} />
                  Use the Timing Oracle&apos;s picks
                </button>
              </form>
            ) : undefined
          }
        />

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {byDay.map((daySlots, day) => (
            <div
              key={day}
              className="card p-3"
              style={{ background: "var(--bg-elevated)" }}
            >
              <p className="mb-2 text-[0.75rem] font-semibold">{DAY_NAMES_FULL[day]}</p>
              {daySlots.length === 0 ? (
                <p className="text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                  No slots
                </p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {daySlots.map((s) => (
                    <li key={s.id}>
                      {canPublish ? (
                        <form action={deleteQueueSlotAction}>
                          <input type="hidden" name="slotId" value={s.id} />
                          <button
                            type="submit"
                            className="chip"
                            title="Remove this slot"
                            style={
                              s.source === "ai"
                                ? {
                                    background: "var(--brand-soft)",
                                    color: "var(--brand-text)",
                                    borderColor: "transparent",
                                  }
                                : undefined
                            }
                          >
                            {String(s.hour).padStart(2, "0")}:
                            {String(s.minute).padStart(2, "0")}
                            <Icon path={ICONS.x} size={10} />
                          </button>
                        </form>
                      ) : (
                        <span className="chip">
                          {String(s.hour).padStart(2, "0")}:
                          {String(s.minute).padStart(2, "0")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {canPublish ? (
          <form
            action={addQueueSlotAction}
            className="mt-4 flex flex-wrap items-end gap-2 border-t pt-4"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="min-w-[140px]">
              <label className="label" htmlFor="slot-day">
                Day
              </label>
              <select id="slot-day" name="dayOfWeek" className="select" defaultValue="1">
                {DAY_NAMES_FULL.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[120px]">
              <label className="label" htmlFor="slot-time">
                Time (UTC)
              </label>
              <input
                id="slot-time"
                name="time"
                type="time"
                defaultValue="09:00"
                className="input"
              />
            </div>
            <button type="submit" className="btn btn-primary">
              <Icon path={ICONS.plus} size={15} />
              Add slot
            </button>
          </form>
        ) : null}
      </Card>

      {/* ------------------------------------------------------- media */}
      <Card id="media">
        <SectionHeader
          title="Media library"
          subtitle="Images and video available to the composer. Add anything reachable over https."
          icon={ICONS.image}
        />
        <MediaForm />
        {media.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {media.map((m) => (
              <li key={m.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.url}
                  alt={m.alt ?? ""}
                  className="h-20 w-20 rounded-lg object-cover"
                  style={{ border: "1px solid var(--border)" }}
                  loading="lazy"
                />
                <form action={deleteMediaAction} className="absolute right-1 top-1">
                  <input type="hidden" name="mediaId" value={m.id} />
                  <button
                    type="submit"
                    className="flex h-5 w-5 items-center justify-center rounded-full text-white"
                    style={{ background: "rgb(0 0 0 / 0.65)" }}
                    aria-label="Delete this media"
                    title="Delete"
                  >
                    <Icon path={ICONS.x} size={11} strokeWidth={2.5} />
                  </button>
                </form>
                {!m.alt ? (
                  <span
                    className="absolute bottom-1 left-1 rounded px-1 text-[0.5625rem] font-semibold"
                    style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
                    title="No alt text - screen readers cannot describe this"
                  >
                    no alt
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[0.8125rem]" style={{ color: "var(--text-faint)" }}>
            Nothing in the library yet.
          </p>
        )}
      </Card>

      {/* ------------------------------------------------------- system */}
      <Card>
        <SectionHeader
          title="System"
          subtitle="What this installation is configured to do"
          icon={ICONS.settings}
        />
        <dl className="grid grid-cols-1 gap-x-8 gap-y-2.5 text-[0.8125rem] sm:grid-cols-2">
          <Row
            label="AI engine"
            value={
              isAiConfigured() ? (
                <Badge tone="brand">Claude · {aiModel()}</Badge>
              ) : (
                <Badge>Built-in heuristics</Badge>
              )
            }
          />
          <Row
            label="Background worker"
            value={
              worker.running ? (
                <Badge tone="good">Running every {worker.tickSeconds}s</Badge>
              ) : worker.enabled ? (
                <Badge tone="warn">Starting</Badge>
              ) : (
                <Badge tone="bad">Disabled</Badge>
              )
            }
          />
          <Row label="Worker ticks" value={String(worker.tickCount)} />
          <Row
            label="Last tick"
            value={worker.lastTick ? formatRelative(worker.lastTick.at) : "not yet"}
          />
          <Row
            label="Automations enabled"
            value={`${rules.filter((r) => r.enabled).length} of ${rules.length}`}
          />
          <Row label="Networks supported" value={String(PLATFORMS.length)} />
          <Row label="Live publishers shipped" value={String(liveAdapters)} />
          <Row label="Workspace timezone" value={user.workspace.timezone} />
        </dl>

        {!isAiConfigured() ? (
          <p
            className="mt-4 rounded-lg p-3 text-[0.8125rem] leading-relaxed"
            style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
          >
            To put the agents on Claude, set <code className="kbd">ANTHROPIC_API_KEY</code>{" "}
            in your environment and restart. Optionally set{" "}
            <code className="kbd">CHORUS_AI_MODEL</code> and{" "}
            <code className="kbd">CHORUS_AI_EFFORT</code> to change the model and how hard
            it thinks. Until then every agent runs on its built-in implementation, which
            uses your real data and needs no network.
          </p>
        ) : null}
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt style={{ color: "var(--text-muted)" }}>{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
