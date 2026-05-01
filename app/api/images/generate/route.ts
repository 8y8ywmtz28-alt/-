import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { saveBase64Image } from "@/lib/save-image";

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY 缺失" }, { status: 500 });
    const { prompt, size, quality, output_format } = await req.json();
    if (!prompt) return NextResponse.json({ error: "prompt 不能为空" }, { status: 400 });

    const result = await openai.images.generate({ model: "gpt-image-2", prompt, size, quality, output_format });
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) return NextResponse.json({ error: "模型未返回图片" }, { status: 500 });
    const url = await saveBase64Image(b64, output_format || "png");

    return NextResponse.json({ image: { id: crypto.randomUUID(), url, prompt, createdAt: new Date().toISOString(), size, quality, format: output_format } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "生成失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
