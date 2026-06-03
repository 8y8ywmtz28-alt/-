import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeJob } from "@/lib/serializers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 30), 100);
  const [jobs, counts] = await Promise.all([
    prisma.generationJob.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { logs: { orderBy: { createdAt: "desc" }, take: 8 }, images: true },
    }),
    prisma.generationJob.groupBy({ by: ["status"], _count: { status: true } }),
  ]);

  return NextResponse.json({
    jobs: jobs.map(serializeJob),
    counts: Object.fromEntries(counts.map((item) => [item.status, item._count.status])),
  });
}
