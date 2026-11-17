/**
 * Next.js runs this once per server process, before handling any request.
 * It is where the background worker is started.
 */
export async function register(): Promise<void> {
  // The worker uses Prisma and the filesystem, so it must not run on the edge.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startWorker } = await import("./src/lib/worker/scheduler");
  startWorker();
}
