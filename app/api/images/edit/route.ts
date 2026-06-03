import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { editJsonSchema } from "@/lib/validation";
import { getAppSettings } from "@/lib/settings";
import { saveUploadedFile } from "@/lib/storage";
import { parseImageQuality, parseImageSize, parseOutputFormat } from "@/lib/image-options";
import { serializeJob } from "@/lib/serializers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOADS = 16;

async function createUploadAssets(files: File[]) {
  const assets = [];
  for (const file of files.slice(0, MAX_UPLOADS)) {
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
    assets.push(asset);
  }
  return assets;
}

export async function POST(req: Request) {
  try {
    const settings = await getAppSettings();
    if (!settings.hasApiKey) {
      return NextResponse.json({ error: "缺少 OPENAI_API_KEY，请先完成初始化配置" }, { status: 428 });
    }

    const contentType = req.headers.get("content-type") || "";
    let prompt = "";
    let size = settings.defaultSize;
    let quality = settings.defaultQuality;
    let outputFormat = settings.defaultFormat;
    let referenceAssets: { id: string; url: string }[] = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      prompt = String(form.get("prompt") || "").trim();
      size = parseImageSize(form.get("size"), settings.defaultSize);
      quality = parseImageQuality(form.get("quality"), settings.defaultQuality);
      outputFormat = parseOutputFormat(form.get("output_format"), settings.defaultFormat);
      const files = form.getAll("images").filter((entry): entry is File => typeof File !== "undefined" && entry instanceof File);
      if (files.length === 0) return NextResponse.json({ error: "请上传至少一张参考图" }, { status: 400 });
      referenceAssets = await createUploadAssets(files);
    } else {
      const json = (await req.json()) as unknown;
      const parsed = editJsonSchema.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || "参数不合法" }, { status: 400 });
      }
      prompt = parsed.data.prompt;
      size = parsed.data.size;
      quality = parsed.data.quality;
      outputFormat = parsed.data.output_format;
      referenceAssets = await prisma.imageAsset.findMany({
        where: { id: { in: parsed.data.imageAssetIds } },
        select: { id: true, url: true },
      });
    }

    if (!prompt) return NextResponse.json({ error: "prompt 不能为空" }, { status: 400 });
    if (referenceAssets.length === 0) return NextResponse.json({ error: "没有可用参考图" }, { status: 400 });

    const batch = await prisma.generationBatch.create({
      data: {
        name: `改图：${prompt.slice(0, 36)}`,
        mode: "edit",
        promptCount: 1,
        imagesPerPrompt: 1,
      },
    });
    const job = await prisma.generationJob.create({
      data: {
        type: "edit",
        prompt,
        batchId: batch.id,
        referenceImageUrls: JSON.stringify(referenceAssets.map((asset) => asset.url)),
        paramsJson: JSON.stringify({
          size,
          quality,
          output_format: outputFormat,
          sourceImageIds: referenceAssets.map((asset) => asset.id),
        }),
        logs: { create: { message: "改图任务已加入本地队列" } },
      },
    });

    return NextResponse.json({ job: serializeJob(job), batchId: batch.id, references: referenceAssets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建改图任务失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
