import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addQueueLog, refreshBatchStatus } from "@/lib/queue";
import { serializeJob } from "@/lib/serializers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, context: Params) {
  const { id } = await context.params;
  const job = await prisma.generationJob.findUnique({
    where: { id },
    include: { logs: { orderBy: { createdAt: "desc" } }, images: true },
  });
  if (!job) return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  return NextResponse.json({ job: serializeJob(job) });
}

export async function PATCH(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const body = (await req.json()) as { action?: string };
    const job = await prisma.generationJob.findUnique({ where: { id } });
    if (!job) return NextResponse.json({ error: "任务不存在" }, { status: 404 });

    if (body.action === "cancel") {
      const updated = await prisma.generationJob.update({
        where: { id },
        data: { status: "canceled", canceledAt: new Date() },
        include: { logs: true, images: true },
      });
      await addQueueLog(id, "任务已取消", "warn");
      await refreshBatchStatus(job.batchId);
      return NextResponse.json({ job: serializeJob(updated) });
    }

    if (body.action === "retry") {
      const updated = await prisma.generationJob.update({
        where: { id },
        data: { status: "queued", error: null, completedAt: null, canceledAt: null },
        include: { logs: true, images: true },
      });
      await addQueueLog(id, "任务已重新排队");
      await refreshBatchStatus(job.batchId);
      return NextResponse.json({ job: serializeJob(updated) });
    }

    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新任务失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
