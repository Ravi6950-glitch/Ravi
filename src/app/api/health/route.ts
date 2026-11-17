import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { workerStatus } from "@/lib/worker/scheduler";
import { isAiConfigured, aiModel } from "@/lib/agents/client";
import { PLATFORMS } from "@/lib/platforms/registry";

/**
 * Health and readiness.
 *
 * Deliberately reports only aggregate, non-identifying numbers: no workspace
 * names, no handles, no account details. It is an operational endpoint, not a
 * data export.
 */
export async function GET() {
  const started = Date.now();
  let database = "ok";
  let accounts = 0;
  let scheduledPosts = 0;

  try {
    [accounts, scheduledPosts] = await Promise.all([
      prisma.socialAccount.count(),
      prisma.post.count({ where: { status: { in: ["SCHEDULED", "QUEUED"] } } }),
    ]);
  } catch (err) {
    database = err instanceof Error ? `error: ${err.message}` : "error";
  }

  const worker = workerStatus();

  return NextResponse.json(
    {
      service: "chorus",
      status: database === "ok" ? "healthy" : "degraded",
      database,
      platformsSupported: PLATFORMS.length,
      connectedAccounts: accounts,
      scheduledPosts,
      aiEngine: isAiConfigured() ? aiModel() : "heuristic",
      worker: {
        enabled: worker.enabled,
        running: worker.running,
        tickSeconds: worker.tickSeconds,
        tickCount: worker.tickCount,
        lastTickAt: worker.lastTick?.at ?? null,
      },
      checkedInMs: Date.now() - started,
    },
    {
      status: database === "ok" ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
