import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveUploadedFile } from "@/lib/storage";
import { serializeImage } from "@/lib/serializers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const files = form.getAll("images").filter((entry): entry is File => typeof File !== "undefined" && entry instanceof File);
    if (files.length === 0) return NextResponse.json({ error: "没有收到图片文件" }, { status: 400 });

    const assets = [];
    for (const file of files.slice(0, 16)) {
      const stored = await saveUploadedFile(file);
      const asset = await prisma.imageAsset.create({
        data: {
          url: stored.url,
          filePath: stored.filePath,
          kind: "upload",
          prompt: file.name,
          format: file.type.split("/")[1] || "png",
        },
      });
      assets.push(serializeImage(asset));
    }

    return NextResponse.json({ images: assets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "上传失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
