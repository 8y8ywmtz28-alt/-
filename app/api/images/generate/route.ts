import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generationSchema } from "@/lib/validation";
import { getAppSettings } from "@/lib/settings";
import { serializeBatch, serializeJob } from "@/lib/serializers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const settings = await getAppSettings();
    if (!settings.hasApiKey) {
      return NextResponse.json({ error: "缺少 OPENAI_API_KEY，请先完成初始化配置" }, { status: 428 });
    }

    const json = (await req.json()) as unknown;
    const parsed = generationSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "参数不合法" }, { status: 400 });
    }

    const prompts = parsed.data.prompts?.length ? parsed.data.prompts : parsed.data.prompt ? [parsed.data.prompt] : [];
    if (prompts.length === 0) {
      return NextResponse.json({ error: "请输入 prompt" }, { status: 400 });
    }

    const batch = await prisma.generationBatch.create({
      data: {
        name: parsed.data.batchName || (prompts.length > 1 ? `批量生成 ${new Date().toLocaleString("zh-CN")}` : prompts[0].slice(0, 42)),
        mode: prompts.length > 1 || parsed.data.count > 1 ? "batch" : "single",
        promptCount: prompts.length,
        imagesPerPrompt: parsed.data.count,
      },
    });

    const jobs = [];
    for (const prompt of prompts) {
      for (let index = 0; index < parsed.data.count; index += 1) {
        const job = await prisma.generationJob.create({
          data: {
            type: "generate",
            prompt,
            batchId: batch.id,
            paramsJson: JSON.stringify({
              size: parsed.data.size,
              quality: parsed.data.quality,
              output_format: parsed.data.output_format,
            }),
            logs: { create: { message: "任务已加入本地队列" } },
          },
        });
        jobs.push(job);
      }
    }

    const withJobs = await prisma.generationBatch.findUnique({
      where: { id: batch.id },
      include: { jobs: true, images: true },
    });

    return NextResponse.json({
      batch: withJobs ? serializeBatch(withJobs) : serializeBatch(batch),
      jobs: jobs.map(serializeJob),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建生成任务失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
