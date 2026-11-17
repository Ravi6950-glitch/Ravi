import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AGENTS, agentName, getAgent } from "@/lib/agents/registry";
import { aiModel, isAiConfigured } from "@/lib/agents/client";
import { workerStatus } from "@/lib/worker/scheduler";
import { platformOrFallback } from "@/lib/platforms/registry";
import {
  Badge,
  Card,
  EmptyState,
  Icon,
  ICONS,
  PlatformAvatar,
  SectionHeader,
  formatDateTime,
  formatRelative,
  formatNumber,
} from "@/components/ui";
import { ScoreRing } from "@/components/charts";
import {
  applyQueueMoveAction,
  runAgentAction,
  toggleAutomationAction,
  updateAutomationIntervalAction,
} from "../actions";

export const metadata: Metadata = { title: "AI agents" };
export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const user = await requireUser();
  const workspaceId = user.workspace.id;
  const canRun = ["OWNER", "ADMIN", "EDITOR"].includes(user.role);

  const [rules, runs, audits, accountCount] = await Promise.all([
    prisma.automationRule.findMany({
      where: { workspaceId },
      orderBy: { agent: "asc" },
    }),
    prisma.agentRun.findMany({
      where: { workspaceId },
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
    prisma.profileAudit.findMany({
      where: { workspaceId },
      include: { account: true },
      orderBy: { createdAt: "desc" },
      distinct: ["accountId"],
    }),
    prisma.socialAccount.count({ where: { workspaceId } }),
  ]);

  const aiOn = isAiConfigured();
  const worker = workerStatus();

  // The most recent queue-optimizer output, so its proposals are actionable.
  const lastQueueRun = runs.find(
    (r) => r.agent === "queue-optimizer" && r.status === "SUCCEEDED" && r.output,
  );
  const queueOutput = lastQueueRun ? safeParse(lastQueueRun.output) : null;
  const moves = Array.isArray(queueOutput?.moves) ? queueOutput.moves : [];
  const warnings = Array.isArray(queueOutput?.warnings) ? queueOutput.warnings : [];

  const totalTokens = runs.reduce((t, r) => t + r.inputTokens + r.outputTokens, 0);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.5rem] font-bold tracking-[-0.02em]">AI agents</h1>
          <p className="mt-0.5 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            Seven agents. {rules.filter((r) => r.enabled).length} running on a schedule ·{" "}
            {runs.length} recent run{runs.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {aiOn ? (
            <Badge tone="brand">Claude · {aiModel()}</Badge>
          ) : (
            <Badge>Built-in engine</Badge>
          )}
          {worker.running ? (
            <Badge tone="good">
              <span className="pulse">●</span> Worker live
            </Badge>
          ) : (
            <Badge tone="warn">Worker starting</Badge>
          )}
        </div>
      </header>

      {/* Engine banner */}
      {!aiOn ? (
        <Card>
          <div className="flex flex-wrap items-start gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ background: "var(--info-soft)", color: "var(--info)" }}
            >
              <Icon path={ICONS.info} size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem] font-semibold">
                Agents are running on the built-in engine
              </p>
              <p
                className="mt-1 text-[0.8125rem] leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                Everything works: every agent has a complete deterministic
                implementation that reads your real data, and the scheduler runs them
                around the clock. Setting <code className="kbd">ANTHROPIC_API_KEY</code>{" "}
                in your environment swaps them onto Claude, which gives markedly better
                copywriting and sharper analysis. Nothing else changes.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Agent cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {AGENTS.map((agent) => {
          const rule = rules.find((r) => r.agent === agent.key);
          const lastRun = runs.find((r) => r.agent === agent.key);
          return (
            <Card key={agent.key}>
              <div className="flex items-start gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: `color-mix(in srgb, ${agent.color} 16%, transparent)`,
                    color: agent.color,
                  }}
                >
                  <Icon path={agent.icon} size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[0.9375rem] font-semibold">
                    {agent.name}
                    {rule?.enabled ? (
                      <Badge tone="good">Scheduled</Badge>
                    ) : agent.schedulable ? (
                      <Badge>Paused</Badge>
                    ) : (
                      <Badge tone="info">On demand</Badge>
                    )}
                  </p>
                  <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                    {agent.tagline}
                  </p>
                </div>
              </div>

              <p
                className="mt-3 text-[0.8125rem] leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                {agent.description}
              </p>

              <ul className="mt-3 flex flex-wrap gap-1.5">
                {agent.outputs.map((o) => (
                  <li key={o} className="chip">
                    {o}
                  </li>
                ))}
              </ul>

              {/* Schedule controls */}
              {agent.schedulable && rule ? (
                <div
                  className="mt-4 flex flex-wrap items-end gap-2 border-t pt-3.5"
                  style={{ borderColor: "var(--border)" }}
                >
                  {canRun ? (
                    <>
                      <form action={toggleAutomationAction}>
                        <input type="hidden" name="ruleId" value={rule.id} />
                        <button type="submit" className="btn btn-sm">
                          <Icon path={rule.enabled ? ICONS.pause : ICONS.play} size={13} />
                          {rule.enabled ? "Pause" : "Resume"}
                        </button>
                      </form>
                      <form
                        action={updateAutomationIntervalAction}
                        className="flex items-end gap-1.5"
                      >
                        <input type="hidden" name="ruleId" value={rule.id} />
                        <span>
                          <label
                            className="label mb-1 text-[0.6875rem]"
                            htmlFor={`interval-${rule.id}`}
                          >
                            Every
                          </label>
                          <select
                            id={`interval-${rule.id}`}
                            name="intervalMinutes"
                            defaultValue={String(rule.intervalMinutes)}
                            className="select btn-sm"
                            style={{ minWidth: 118 }}
                          >
                            {[
                              [60, "hour"],
                              [180, "3 hours"],
                              [360, "6 hours"],
                              [720, "12 hours"],
                              [1440, "day"],
                              [4320, "3 days"],
                              [10080, "week"],
                            ].map(([v, l]) => (
                              <option key={String(v)} value={String(v)}>
                                {l}
                              </option>
                            ))}
                          </select>
                        </span>
                        <button type="submit" className="btn btn-sm">
                          Save
                        </button>
                      </form>
                      <form action={runAgentAction} className="ml-auto">
                        <input type="hidden" name="agent" value={agent.key} />
                        <button
                          type="submit"
                          className="btn btn-primary btn-sm"
                          disabled={accountCount === 0}
                          title={
                            accountCount === 0
                              ? "Connect an account first"
                              : `Run ${agent.name} now`
                          }
                        >
                          <Icon path={ICONS.play} size={13} />
                          Run now
                        </button>
                      </form>
                    </>
                  ) : (
                    <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                      Your role cannot run or schedule agents.
                    </p>
                  )}
                </div>
              ) : agent.key === "composer" || agent.key === "hashtag-strategist" ? (
                <div className="mt-4 border-t pt-3.5" style={{ borderColor: "var(--border)" }}>
                  <Link href="/composer" className="btn btn-sm">
                    <Icon path={ICONS.compose} size={13} />
                    Use in the composer
                  </Link>
                </div>
              ) : null}

              {/* Last run */}
              {lastRun ? (
                <p
                  className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem]"
                  style={{ color: "var(--text-faint)" }}
                >
                  <Icon
                    path={lastRun.status === "SUCCEEDED" ? ICONS.check : ICONS.alert}
                    size={11}
                  />
                  Last run {formatRelative(lastRun.startedAt)} · {lastRun.engine}
                  {lastRun.durationMs > 0 ? ` · ${(lastRun.durationMs / 1000).toFixed(1)}s` : ""}
                  {rule?.enabled && rule.nextRunAt
                    ? ` · next ${formatRelative(rule.nextRunAt)}`
                    : ""}
                </p>
              ) : rule?.enabled && rule.nextRunAt ? (
                <p className="mt-3 text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                  First run {formatRelative(rule.nextRunAt)}
                </p>
              ) : null}

              {lastRun?.summary ? (
                <p
                  className="mt-1.5 line-clamp-2 text-[0.75rem] leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  {lastRun.summary}
                </p>
              ) : null}
            </Card>
          );
        })}
      </div>

      {/* Queue optimiser proposals */}
      {moves.length > 0 || warnings.length > 0 ? (
        <Card>
          <SectionHeader
            title="Queue optimiser proposals"
            subtitle={`From the run ${formatRelative(lastQueueRun?.startedAt)}. Nothing is moved until you say so.`}
            icon={ICONS.queue}
          />
          {warnings.length > 0 ? (
            <ul className="mb-4 flex flex-col gap-1.5">
              {warnings.map((w, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-lg px-3 py-2 text-[0.8125rem]"
                  style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
                >
                  <Icon path={ICONS.alert} size={14} className="mt-[2px] shrink-0" />
                  <span>
                    <strong className="capitalize">{String(w.kind)}:</strong>{" "}
                    {String(w.detail)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {moves.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {moves.map((m, i) => (
                <li
                  key={i}
                  className="card flex flex-wrap items-center gap-3 p-3"
                  style={{ background: "var(--bg-elevated)" }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.8125rem]">
                      <span style={{ color: "var(--text-faint)" }}>
                        {formatDateTime(String(m.fromIso))}
                      </span>
                      <Icon
                        path={ICONS.chevronRight}
                        size={12}
                        className="mx-1.5 inline opacity-50"
                      />
                      <strong>{formatDateTime(String(m.toIso))}</strong>{" "}
                      <span style={{ color: "var(--text-faint)" }}>UTC</span>
                    </p>
                    <p className="mt-0.5 text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
                      {String(m.reason)}
                    </p>
                  </div>
                  {typeof m.expectedLift === "number" && m.expectedLift > 0 ? (
                    <Badge tone="good">+{Math.round(m.expectedLift)}% est.</Badge>
                  ) : null}
                  {canRun ? (
                    <form action={applyQueueMoveAction}>
                      <input type="hidden" name="postId" value={String(m.postId)} />
                      <input type="hidden" name="toIso" value={String(m.toIso)} />
                      <button type="submit" className="btn btn-sm">
                        <Icon path={ICONS.check} size={13} />
                        Apply
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      {/* Profile audits */}
      <Card>
        <SectionHeader
          title="Profile audits"
          subtitle="The Profile Auditor scores every connected account and names the fixes"
          icon={ICONS.users}
          action={
            canRun ? (
              <form action={runAgentAction}>
                <input type="hidden" name="agent" value="profile-auditor" />
                <button type="submit" className="btn btn-sm" disabled={accountCount === 0}>
                  <Icon path={ICONS.refresh} size={13} />
                  Re-audit
                </button>
              </form>
            ) : undefined
          }
        />
        {audits.length === 0 ? (
          <EmptyState
            icon={ICONS.shield}
            title="No audits yet"
            body={
              accountCount === 0
                ? "Connect an account and the auditor will grade it on its next run."
                : "The auditor runs daily. Run it now to see your scores immediately."
            }
            action={
              accountCount === 0 ? (
                <Link href="/accounts" className="btn btn-primary btn-sm">
                  Connect an account
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {audits.map((audit) => {
              const issues = safeParseArray(audit.issues);
              const strengths = safeParseArray(audit.strengths);
              const high = issues.filter((i) => i.severity === "high");
              return (
                <li
                  key={audit.id}
                  className="card p-4"
                  style={{ background: "var(--bg-elevated)" }}
                >
                  <div className="flex flex-wrap items-start gap-4">
                    <ScoreRing
                      score={audit.score}
                      size={56}
                      label={`@${audit.account.handle}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <PlatformAvatar
                          platform={audit.account.platform}
                          size={20}
                          handle={audit.account.handle}
                        />
                        <span className="text-[0.9375rem] font-semibold">
                          @{audit.account.handle}
                        </span>
                        <Badge
                          tone={
                            audit.grade === "A"
                              ? "good"
                              : audit.grade === "B"
                                ? "info"
                                : audit.grade === "C"
                                  ? "warn"
                                  : "bad"
                          }
                        >
                          Grade {audit.grade}
                        </Badge>
                        <span className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                          {platformOrFallback(audit.account.platform).name} ·{" "}
                          {formatRelative(audit.createdAt)}
                        </span>
                      </p>
                      {audit.summary ? (
                        <p
                          className="mt-1.5 text-[0.8125rem] leading-relaxed"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {audit.summary}
                        </p>
                      ) : null}
                      {audit.cadence ? (
                        <p className="mt-1 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                          Cadence: {audit.cadence}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {issues.length > 0 ? (
                    <ul
                      className="mt-3.5 flex flex-col gap-2 border-t pt-3.5"
                      style={{ borderColor: "var(--border)" }}
                    >
                      {issues.slice(0, 4).map((issue, i) => (
                        <li key={i} className="flex gap-2.5">
                          <span
                            className="mt-[5px] h-2 w-2 shrink-0 rounded-full"
                            style={{
                              background:
                                issue.severity === "high"
                                  ? "var(--bad)"
                                  : issue.severity === "medium"
                                    ? "var(--warn)"
                                    : "var(--text-faint)",
                            }}
                          />
                          <div className="min-w-0">
                            <p className="text-[0.8125rem] font-medium">{issue.title}</p>
                            <p
                              className="text-[0.75rem] leading-relaxed"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {issue.detail}
                            </p>
                            {issue.fix ? (
                              <p
                                className="mt-0.5 text-[0.75rem] font-medium"
                                style={{ color: "var(--brand-text)" }}
                              >
                                Fix: {issue.fix}
                              </p>
                            ) : null}
                          </div>
                        </li>
                      ))}
                      {issues.length > 4 ? (
                        <li className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                          +{issues.length - 4} more issue(s)
                        </li>
                      ) : null}
                    </ul>
                  ) : null}

                  {strengths.length > 0 && high.length === 0 ? (
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {strengths.slice(0, 3).map((s, i) => (
                        <li
                          key={i}
                          className="chip"
                          style={{ background: "var(--good-soft)", color: "var(--good)", borderColor: "transparent" }}
                        >
                          <Icon path={ICONS.check} size={10} strokeWidth={3} />
                          {typeof s === "string" ? s : String(s)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Run log */}
      <Card padded={false}>
        <div className="p-5 pb-3">
          <SectionHeader
            title="Run log"
            subtitle={
              totalTokens > 0
                ? `${formatNumber(totalTokens)} tokens across the last ${runs.length} runs`
                : "Every agent run, and which engine produced it"
            }
            icon={ICONS.clock}
          />
        </div>
        {runs.length === 0 ? (
          <EmptyState
            icon={ICONS.agent}
            title="No runs yet"
            body="The scheduler starts the first agents within a minute of the server booting."
          />
        ) : (
          <div className="overflow-x-auto px-5 pb-5">
            <table className="w-full text-left text-[0.8125rem]">
              <thead>
                <tr style={{ color: "var(--text-faint)" }}>
                  <th className="pb-2 pr-3 font-medium">Agent</th>
                  <th className="pb-2 pr-3 font-medium">Trigger</th>
                  <th className="pb-2 pr-3 font-medium">Engine</th>
                  <th className="pb-2 pr-3 font-medium">Result</th>
                  <th className="pb-2 pr-3 text-right font-medium">Tokens</th>
                  <th className="pb-2 pr-3 text-right font-medium">Took</th>
                  <th className="pb-2 text-right font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                {runs.map((run) => {
                  const def = getAgent(run.agent);
                  return (
                    <tr key={run.id}>
                      <td className="py-2.5 pr-3">
                        <span className="flex items-center gap-2">
                          {def ? (
                            <Icon path={def.icon} size={14} className="shrink-0 opacity-70" />
                          ) : null}
                          <span className="whitespace-nowrap font-medium">
                            {agentName(run.agent)}
                          </span>
                        </span>
                      </td>
                      <td className="py-2.5 pr-3" style={{ color: "var(--text-muted)" }}>
                        {run.trigger}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge tone={run.engine === "claude" ? "brand" : "neutral"}>
                          {run.engine}
                        </Badge>
                      </td>
                      <td className="max-w-[320px] py-2.5 pr-3">
                        <span className="flex items-start gap-1.5">
                          <Badge tone={run.status === "SUCCEEDED" ? "good" : "bad"}>
                            {run.status === "SUCCEEDED" ? "OK" : "Failed"}
                          </Badge>
                          <span className="line-clamp-2" style={{ color: "var(--text-muted)" }}>
                            {run.error ?? run.summary ?? "-"}
                          </span>
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {run.inputTokens + run.outputTokens > 0
                          ? formatNumber(run.inputTokens + run.outputTokens)
                          : "-"}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {run.durationMs > 0 ? `${(run.durationMs / 1000).toFixed(1)}s` : "-"}
                      </td>
                      <td
                        className="py-2.5 text-right whitespace-nowrap"
                        style={{ color: "var(--text-faint)" }}
                      >
                        {formatRelative(run.startedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- utils */

function safeParse(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

interface AuditIssue {
  title: string;
  detail: string;
  severity: string;
  fix?: string;
}

function safeParseArray(raw: string): AuditIssue[] {
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.map((x) =>
      typeof x === "string"
        ? { title: x, detail: "", severity: "low" }
        : {
            title: String((x as AuditIssue).title ?? ""),
            detail: String((x as AuditIssue).detail ?? ""),
            severity: String((x as AuditIssue).severity ?? "low"),
            fix: (x as AuditIssue).fix ? String((x as AuditIssue).fix) : undefined,
          },
    );
  } catch {
    return [];
  }
}
