"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, KeyRound, Loader2, Sparkles, Wand2 } from "lucide-react";
import type { AppSettings } from "@/types";

interface SettingsResponse {
  settings: AppSettings;
}

interface TestResponse {
  ok: boolean;
  error?: string;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(body.error || "请求失败");
  return body as T;
}

export function SetupWizard() {
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void requestJson<SettingsResponse>("/api/settings").then((data) => setSettings(data.settings));
  }, []);

  const testKey = async () => {
    setTesting(true);
    setError(null);
    setMessage(null);
    try {
      const result = await requestJson<TestResponse>("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", apiKey }),
      });
      if (result.ok) setMessage("连接成功，API Key 可以使用。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "测试失败");
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await requestJson<SettingsResponse>("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          imageModel: settings?.imageModel || "gpt-image-1.5",
          responsesModel: settings?.responsesModel || "gpt-5",
          defaultSize: settings?.defaultSize || "1024x1024",
          defaultQuality: settings?.defaultQuality || "auto",
          defaultFormat: settings?.defaultFormat || "png",
          maxConcurrency: settings?.maxConcurrency || 1,
        }),
      });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[0.92fr_1.08fr]">
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/12 px-4 py-2 text-sm text-primary">
            <Sparkles className="h-4 w-4" />
            本地优先的 GPT 图片工作台
          </div>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">先完成一键配置，然后开始创作。</h1>
            <p className="max-w-2xl text-base leading-8 text-muted-foreground">
              API Key 会优先读取环境变量；如果你选择保存在页面里，它只会写入本地 SQLite 数据库，适合个人电脑本地使用。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {["SQLite 队列", "多轮改图", "本地图库"].map((item) => (
              <div key={item} className="rounded-3xl bg-surface-container p-4 text-sm shadow-md3">
                <Check className="mb-3 h-5 w-5 text-tertiary" />
                {item}
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="md-surface rounded-[2rem] p-5 md:p-7">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">初始化 OpenAI API</h2>
              <p className="text-sm text-muted-foreground">VSCode 终端里运行 npm run dev 后会自动进入这里。</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium">OpenAI API Key</label>
            <input
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-..."
              type="password"
              className="h-14 w-full rounded-2xl border border-border bg-surface px-4 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={testKey}
                disabled={testing || !apiKey.trim()}
                className="md-ripple inline-flex h-12 items-center justify-center gap-2 rounded-full bg-secondary-container px-5 font-medium text-foreground disabled:opacity-45"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                测试连接
              </button>
              <button
                onClick={save}
                disabled={saving || (!apiKey.trim() && settings?.apiKeySource === "missing")}
                className="md-ripple inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 font-medium text-primary-foreground disabled:opacity-45"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                保存并进入
              </button>
            </div>
            {message && <p className="rounded-2xl bg-tertiary/12 px-4 py-3 text-sm text-tertiary">{message}</p>}
            {error && <p className="rounded-2xl bg-error/12 px-4 py-3 text-sm text-error">{error}</p>}
            <div className="rounded-3xl bg-surface-container-high p-4 text-sm leading-7 text-muted-foreground">
              当前默认图片模型：{settings?.imageModel || "gpt-image-1.5"}。如果你的账号已开放更新的图像模型，可以进入设置页修改模型 ID。
            </div>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
