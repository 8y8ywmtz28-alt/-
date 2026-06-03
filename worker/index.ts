import "dotenv/config";
import { prisma } from "../lib/prisma";
import { executeGenerationJob } from "../lib/openai-executor";
import { addQueueLog, refreshBatchStatus } from "../lib/queue";
import { getAppSettings } from "../lib/settings";

const POLL_MS = 1200;
const running = new Set<string>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function claimNextJob() {
  const next = await prisma.generationJob.findFirst({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
  });
  if (!next) return null;

  const claimed = await prisma.generationJob.updateMany({
    where: { id: next.id, status: "queued" },
    data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } },
  });
  if (claimed.count !== 1) return null;

  await refreshBatchStatus(next.batchId);
  const job = await prisma.generationJob.findUnique({ where: { id: next.id } });
  return job;
}

async function startJob() {
  const job = await claimNextJob();
  if (!job) return;

  running.add(job.id);
  await addQueueLog(job.id, "worker 已接收任务");
  void executeGenerationJob(job).finally(() => {
    running.delete(job.id);
  });
}

async function loop() {
  console.log("[worker] SQLite queue worker started.");

  while (true) {
    const settings = await getAppSettings();
    const capacity = settings.maxConcurrency - running.size;
    for (let index = 0; index < capacity; index += 1) {
      await startJob();
    }
    await sleep(POLL_MS);
  }
}

loop().catch((error) => {
  console.error("[worker] fatal error", error);
  process.exit(1);
});
