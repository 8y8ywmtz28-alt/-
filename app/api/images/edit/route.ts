import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { saveBase64Image } from "@/lib/save-image";

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY 缺失" }, { status: 500 });

    const form = await req.formData();
    const prompt = form.get("prompt")?.toString();
    const size = form.get("size")?.toString();
    const quality = form.get("quality")?.toString();
    const output_format = form.get("output_format")?.toString() || "png";
    const images = form.getAll("images") as File[];
    if (!prompt || images.length === 0) return NextResponse.json({ error: "请提供 prompt 和图片" }, { status: 400 });

    const uploaded = await Promise.all(images.map(async (f) => new File([await f.arrayBuffer()], f.name, { type: f.type })));
    const result = await openai.images.edit({ model: "gpt-image-2", prompt, image: uploaded, size: size as any, quality: quality as any, output_format: output_format as any });
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) return NextResponse.json({ error: "模型未返回图片" }, { status: 500 });
    const url = await saveBase64Image(b64, output_format);

    return NextResponse.json({ image: { id: crypto.randomUUID(), url, prompt, createdAt: new Date().toISOString(), size, quality, format: output_format } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "改图失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
