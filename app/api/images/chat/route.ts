import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chatSchema } from "@/lib/validation";
import { getAppSettings } from "@/lib/settings";
import { serializeConversation, serializeJob } from "@/lib/serializers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const settings = await getAppSettings();
    if (!settings.hasApiKey) {
      return NextResponse.json({ error: "缺少 OPENAI_API_KEY，请先完成初始化配置" }, { status: 428 });
    }

    const parsed = chatSchema.safeParse((await req.json()) as unknown);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "参数不合法" }, { status: 400 });
    }

    const conversation =
      parsed.data.conversationId
        ? await prisma.conversation.findUnique({ where: { id: parsed.data.conversationId } })
        : await prisma.conversation.create({ data: { title: parsed.data.prompt.slice(0, 42) || "新图片会话" } });

    if (!conversation) return NextResponse.json({ error: "会话不存在" }, { status: 404 });

    const referenceAssets = parsed.data.imageAssetIds.length
      ? await prisma.imageAsset.findMany({ where: { id: { in: parsed.data.imageAssetIds } }, select: { id: true, url: true } })
      : [];

    await prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: parsed.data.prompt,
        metadataJson: JSON.stringify({ referenceImageIds: referenceAssets.map((asset) => asset.id) }),
      },
    });

    const job = await prisma.generationJob.create({
      data: {
        type: "chat",
        prompt: parsed.data.prompt,
        conversationId: conversation.id,
        referenceImageUrls: JSON.stringify(referenceAssets.map((asset) => asset.url)),
        paramsJson: JSON.stringify({
          size: parsed.data.size,
          quality: parsed.data.quality,
          output_format: parsed.data.output_format,
          sourceImageIds: referenceAssets.map((asset) => asset.id),
        }),
        logs: { create: { message: "聊天式改图任务已加入本地队列" } },
      },
    });

    const fullConversation = await prisma.conversation.findUnique({
      where: { id: conversation.id },
      include: { messages: { include: { imageAsset: true }, orderBy: { createdAt: "asc" } }, images: true },
    });

    return NextResponse.json({
      conversation: fullConversation ? serializeConversation(fullConversation) : serializeConversation(conversation),
      job: serializeJob(job),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建聊天式改图任务失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
