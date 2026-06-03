import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeBatch } from "@/lib/serializers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const batches = await prisma.generationBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { jobs: true, images: true },
  });
  return NextResponse.json({ batches: batches.map(serializeBatch) });
}
