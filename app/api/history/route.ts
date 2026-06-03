import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeBatch, serializeConversation, serializeImage } from "@/lib/serializers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [images, batches, conversations] = await Promise.all([
    prisma.imageAsset.findMany({ orderBy: { createdAt: "desc" }, take: 80 }),
    prisma.generationBatch.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { images: true, jobs: true } }),
    prisma.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      take: 12,
      include: { messages: { include: { imageAsset: true }, orderBy: { createdAt: "asc" } }, images: true },
    }),
  ]);

  return NextResponse.json({
    images: images.map(serializeImage),
    batches: batches.map(serializeBatch),
    conversations: conversations.map(serializeConversation),
  });
}
