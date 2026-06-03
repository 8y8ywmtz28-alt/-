import { prisma } from "./prisma";

export async function addQueueLog(jobId: string, message: string, level = "info", meta?: unknown) {
  await prisma.queueLog.create({
    data: {
      jobId,
      level,
      message,
      metaJson: meta ? JSON.stringify(meta) : "{}",
    },
  });
}

export async function refreshBatchStatus(batchId?: string | null) {
  if (!batchId) return;

  const jobs = await prisma.generationJob.findMany({
    where: { batchId },
    select: { status: true },
  });
  if (jobs.length === 0) return;

  const status = jobs.every((job) => job.status === "completed")
    ? "completed"
    : jobs.some((job) => job.status === "running")
      ? "running"
      : jobs.some((job) => job.status === "failed")
        ? "failed"
        : jobs.every((job) => job.status === "canceled")
          ? "canceled"
          : "queued";

  await prisma.generationBatch.update({ where: { id: batchId }, data: { status } });
}

export function safeJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
