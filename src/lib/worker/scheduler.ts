import { prisma } from "@/lib/db";
import { runAgentByKey } from "@/lib/agents/run";
import { publishDuePosts } from "./publish";
import { syncAllAnalytics } from "./analytics";

/**
 * The background worker.
 *
 * One interval in the Node.js process, started from instrumentation.ts. Each
 * tick does three things: publish anything due, keep analytics current, and
 * run any automation rule whose turn has come. A tick never overlaps itself,
 * and a failure in one job never stops the others.
 */

export interface TickReport {
  at: string;
  publishedPosts: number;
  failedPosts: number;
  analyticsAccounts: number;
  agentRuns: Array<{ agent: string; workspaceId: string; engine: string; ok: boolean; detail: string }>;
  errors: string[];
  durationMs: number;
}

interface WorkerState {
  timer?: ReturnType<typeof setInterval>;
  running: boolean;
  startedAt?: Date;
  lastTick?: TickReport;
  tickCount: number;
  lastAnalyticsSync?: number;
}

// Survives hot reload in development, so edits do not stack up timers.
const globalForWorker = globalThis as unknown as { chorusWorker?: WorkerState };
const state: WorkerState =
  globalForWorker.chorusWorker ?? (globalForWorker.chorusWorker = { running: false, tickCount: 0 });

const ANALYTICS_INTERVAL_MS = 5 * 60 * 1000;

export async function tick(): Promise<TickReport> {
  const started = Date.now();
  const report: TickReport = {
    at: new Date().toISOString(),
    publishedPosts: 0,
    failedPosts: 0,
    analyticsAccounts: 0,
    agentRuns: [],
    errors: [],
    durationMs: 0,
  };

  // --- 1. Publish anything whose time has come --------------------------
  try {
    const results = await publishDuePosts(10);
    for (const r of results) {
      if (r.status === "PUBLISHED" || r.status === "PARTIAL") report.publishedPosts++;
      if (r.status === "FAILED") report.failedPosts++;
    }
  } catch (err) {
    report.errors.push(`publish: ${err instanceof Error ? err.message : String(err)}`);
  }

  // --- 2. Keep analytics current (every 5 minutes, not every tick) ------
  try {
    const due =
      !state.lastAnalyticsSync || Date.now() - state.lastAnalyticsSync > ANALYTICS_INTERVAL_MS;
    if (due) {
      const synced = await syncAllAnalytics();
      report.analyticsAccounts = synced.accounts;
      state.lastAnalyticsSync = Date.now();
    }
  } catch (err) {
    report.errors.push(`analytics: ${err instanceof Error ? err.message : String(err)}`);
  }

  // --- 3. Run automation rules that are due -----------------------------
  try {
    const now = new Date();
    const rules = await prisma.automationRule.findMany({
      where: {
        enabled: true,
        OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
      },
      orderBy: { nextRunAt: "asc" },
      // A couple per tick keeps any one workspace from monopolising the worker.
      take: 3,
    });

    for (const rule of rules) {
      // Claim the rule first, so a long-running agent cannot be started twice.
      await prisma.automationRule.update({
        where: { id: rule.id },
        data: {
          lastRunAt: now,
          nextRunAt: new Date(now.getTime() + rule.intervalMinutes * 60_000),
        },
      });

      try {
        const result = await runAgentByKey(rule.agent, {
          workspaceId: rule.workspaceId,
          trigger: "schedule",
        });
        await prisma.automationRule.update({
          where: { id: rule.id },
          data: { lastStatus: "SUCCEEDED" },
        });
        report.agentRuns.push({
          agent: rule.agent,
          workspaceId: rule.workspaceId,
          engine: result.engine,
          ok: true,
          detail: result.summary,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await prisma.automationRule.update({
          where: { id: rule.id },
          data: { lastStatus: `FAILED: ${message.slice(0, 200)}` },
        });
        report.agentRuns.push({
          agent: rule.agent,
          workspaceId: rule.workspaceId,
          engine: "unknown",
          ok: false,
          detail: message,
        });
      }
    }
  } catch (err) {
    report.errors.push(`automation: ${err instanceof Error ? err.message : String(err)}`);
  }

  report.durationMs = Date.now() - started;
  state.lastTick = report;
  state.tickCount++;
  return report;
}

export function startWorker(): void {
  if (state.timer) return; // already running
  if (process.env.CHORUS_WORKER_ENABLED === "false") {
    console.log("[chorus] background worker disabled (CHORUS_WORKER_ENABLED=false)");
    return;
  }

  const seconds = Math.max(
    5,
    Number.parseInt(process.env.CHORUS_WORKER_TICK_SECONDS ?? "30", 10) || 30,
  );
  state.startedAt = new Date();

  const run = async () => {
    if (state.running) return; // never overlap ticks
    state.running = true;
    try {
      await tick();
    } catch (err) {
      console.error("[chorus] worker tick failed:", err);
    } finally {
      state.running = false;
    }
  };

  // Give the server a moment to finish booting before the first tick.
  setTimeout(run, 4000);
  state.timer = setInterval(run, seconds * 1000);
  // Do not hold the process open on shutdown.
  state.timer.unref?.();

  console.log(`[chorus] background worker started - ticking every ${seconds}s`);
}

export function stopWorker(): void {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = undefined;
  }
}

export function workerStatus(): {
  running: boolean;
  startedAt: string | null;
  tickCount: number;
  lastTick: TickReport | null;
  tickSeconds: number;
  enabled: boolean;
} {
  return {
    running: Boolean(state.timer),
    startedAt: state.startedAt?.toISOString() ?? null,
    tickCount: state.tickCount,
    lastTick: state.lastTick ?? null,
    tickSeconds: Math.max(
      5,
      Number.parseInt(process.env.CHORUS_WORKER_TICK_SECONDS ?? "30", 10) || 30,
    ),
    enabled: process.env.CHORUS_WORKER_ENABLED !== "false",
  };
}
