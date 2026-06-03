import { NextResponse } from "next/server";
import { getApiKey, getAppSettings, saveAppSettings } from "@/lib/settings";
import { settingsSchema } from "@/lib/validation";
import { getOpenAIClient } from "@/lib/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getAppSettings();
  return NextResponse.json({ settings });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { action?: string };
    if (body.action === "test") {
      const key = typeof (body as { apiKey?: unknown }).apiKey === "string" ? (body as { apiKey: string }).apiKey : (await getApiKey()).apiKey;
      const client = getOpenAIClient(key);
      if (!client) return NextResponse.json({ ok: false, error: "请先输入 API Key" }, { status: 400 });
      await client.models.list();
      return NextResponse.json({ ok: true });
    }

    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "参数不合法" }, { status: 400 });
    }

    const settings = await saveAppSettings(parsed.data);
    return NextResponse.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存设置失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
