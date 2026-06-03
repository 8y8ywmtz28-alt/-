"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import { useDropzone } from "react-dropzone";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  GalleryHorizontalEnd,
  ImagePlus,
  Layers3,
  Loader2,
  Moon,
  PanelRightOpen,
  RefreshCw,
  RotateCcw,
  Send,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import type { AppSettings, ImageQuality, ImageSize, OutputFormat } from "@/types";
import { IMAGE_QUALITIES, IMAGE_SIZES, OUTPUT_FORMATS } from "@/types";
import { isExperimentalResolution } from "@/lib/image-options";

type Mode = "generate" | "edit" | "chat" | "batch";

interface ImageAsset {
  id: string;
  url: string;
  kind: string;
  prompt?: string | null;
  createdAt: string;
  size?: string | null;
  quality?: string | null;
  format?: string | null;
  batchId?: string | null;
  conversationId?: string | null;
}

interface QueueLog {
  id: string;
  level: string;
  message: string;
  createdAt: string;
}

interface QueueJob {
  id: string;
  type: string;
  status: string;
  prompt: string;
  error?: string | null;
  batchId?: string | null;
  conversationId?: string | null;
  createdAt: string;
  logs?: QueueLog[];
  images?: ImageAsset[];
}

interface HistoryResponse {
  images: ImageAsset[];
  batches: Array<{ id: string; name: string; status: string; images?: ImageAsset[]; jobs?: QueueJob[]; createdAt: string }>;
  conversations: Array<{ id: string; title: string; messages?: Array<{ id: string; role: string; content: string; imageAsset?: ImageAsset | null }> }>;
}

interface QueueResponse {
  jobs: QueueJob[];
  counts: Record<string, number>;
}

interface SettingsResponse {
  settings: AppSettings;
}

interface UploadResponse {
  images: ImageAsset[];
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(body.error || "请求失败");
  return body as T;
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    queued: "排队中",
    running: "生成中",
    completed: "已完成",
    failed: "失败",
    canceled: "已取消",
  };
  return map[status] || status;
}

function statusClass(status: string) {
  if (status === "completed") return "bg-tertiary/15 text-tertiary";
  if (status === "running") return "bg-primary/15 text-primary";
  if (status === "failed") return "bg-error/15 text-error";
  if (status === "canceled") return "bg-muted/15 text-muted";
  return "bg-secondary-container text-foreground";
}

export function StudioApp() {
  const [mode, setMode] = useState<Mode>("generate");
  const [prompt, setPrompt] = useState("");
  const [batchText, setBatchText] = useState("");
  const [imagesPerPrompt, setImagesPerPrompt] = useState(1);
  const [size, setSize] = useState<ImageSize>("1024x1024");
  const [quality, setQuality] = useState<ImageQuality>("auto");
  const [format, setFormat] = useState<OutputFormat>("png");
  const [referenceImages, setReferenceImages] = useState<ImageAsset[]>([]);
  const [history, setHistory] = useState<HistoryResponse>({ images: [], batches: [], conversations: [] });
  const [queue, setQueue] = useState<QueueResponse>({ jobs: [], counts: {} });
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  const refresh = async () => {
    const [historyData, queueData, settingsData] = await Promise.all([
      requestJson<HistoryResponse>("/api/history"),
      requestJson<QueueResponse>("/api/queue/jobs?limit=40"),
      requestJson<SettingsResponse>("/api/settings"),
    ]);
    setHistory(historyData);
    setQueue(queueData);
    setSettings(settingsData.settings);
  };

  useEffect(() => {
    const saved = window.localStorage.getItem("studio-theme") === "light" ? "light" : "dark";
    setTheme(saved);
    document.documentElement.classList.toggle("dark", saved === "dark");
    void refresh().catch((err) => setError(err instanceof Error ? err.message : "刷新数据失败"));
    const timer = window.setInterval(() => void refresh().catch(() => undefined), 2200);
    return () => window.clearInterval(timer);
  }, []);

  const latestImage = useMemo(() => history.images.find((image) => image.kind !== "upload") || null, [history.images]);
  const runningJob = useMemo(() => queue.jobs.find((job) => job.status === "running") || null, [queue.jobs]);
  const queueLength = (queue.counts.queued || 0) + (queue.counts.running || 0);

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setError(null);
    const form = new FormData();
    files.forEach((file) => form.append("images", file));
    try {
      const data = await requestJson<UploadResponse>("/api/upload", { method: "POST", body: form });
      setReferenceImages((current) => [...data.images, ...current].slice(0, 16));
      if (mode === "generate") setMode("edit");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    }
  };

  const dropzone = useDropzone({
    onDrop: (files) => void uploadFiles(files),
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    maxSize: 50 * 1024 * 1024,
  });

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "batch") {
        const prompts = batchText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        if (prompts.length === 0) throw new Error("请在批量输入框中每行输入一个 prompt");
        await requestJson("/api/images/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompts, count: imagesPerPrompt, size, quality, output_format: format }),
        });
        setNotice(`已加入队列：${prompts.length * imagesPerPrompt} 个任务`);
      } else if (mode === "edit") {
        if (referenceImages.length === 0) throw new Error("请先上传或引用一张图片");
        await requestJson("/api/images/edit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, imageAssetIds: referenceImages.map((image) => image.id), size, quality, output_format: format }),
        });
        setNotice("改图任务已加入队列");
      } else if (mode === "chat") {
        const data = await requestJson<{ conversation: { id: string }; job: QueueJob }>("/api/images/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, prompt, imageAssetIds: referenceImages.map((image) => image.id), size, quality, output_format: format }),
        });
        setConversationId(data.conversation.id);
        setNotice("聊天式改图已加入队列");
      } else {
        await requestJson("/api/images/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, count: imagesPerPrompt, size, quality, output_format: format }),
        });
        setNotice("生成任务已加入队列");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem("studio-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  const useImageAsReference = (image: ImageAsset, nextMode: Mode = "chat") => {
    setReferenceImages([image]);
    setPrompt(image.prompt || "");
    setMode(nextMode);
    setNotice("已引用历史图，可以继续编辑。");
  };

  const patchJob = async (id: string, action: "cancel" | "retry") => {
    try {
      await requestJson(`/api/queue/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      setNotice(action === "cancel" ? "任务已取消" : "任务已重新排队");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    }
  };

  const saveSettings = async (next: Partial<AppSettings> & { apiKey?: string }) => {
    try {
      const data = await requestJson<SettingsResponse>("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      setSettings(data.settings);
      setNotice("设置已保存");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存设置失败");
    }
  };

  return (
    <main className="min-h-screen p-3 md:p-5">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-4">
        <Header queueLength={queueLength} theme={theme} onQueue={() => setQueueOpen(true)} onTheme={toggleTheme} onSettings={() => setSettingsOpen(true)} />

        <div className="grid gap-4 xl:grid-cols-[430px_minmax(420px,1fr)_390px]">
          <section className="md-surface rounded-[2rem] p-4">
            <ModeTabs mode={mode} setMode={setMode} />
            <div className="mt-4 space-y-4">
              {mode === "batch" ? (
                <textarea
                  value={batchText}
                  onChange={(event) => setBatchText(event.target.value)}
                  placeholder={"每行一个 prompt，例如：\n一张柔和晨光里的玻璃咖啡杯\n未来感城市中的白色概念跑车"}
                  className="min-h-[190px] w-full resize-none rounded-3xl border border-border bg-surface px-4 py-4 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
                />
              ) : (
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder={mode === "chat" ? "继续描述你想怎样修改这张图..." : "描述你想生成或编辑的图片..."}
                  className="min-h-[170px] w-full resize-none rounded-3xl border border-border bg-surface px-4 py-4 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
                />
              )}

              <div {...dropzone.getRootProps()} className="rounded-3xl border border-dashed border-border bg-surface-container-high p-4 text-center transition hover:border-primary hover:bg-primary/8">
                <input {...dropzone.getInputProps()} />
                <ImagePlus className="mx-auto mb-2 h-6 w-6 text-primary" />
                <p className="text-sm text-muted-foreground">{dropzone.isDragActive ? "松开以上传参考图" : "拖拽上传参考图，或点击选择图片"}</p>
              </div>

              {referenceImages.length > 0 && <ReferenceStrip images={referenceImages} onRemove={(id) => setReferenceImages((items) => items.filter((item) => item.id !== id))} />}

              <GenerationControls
                size={size}
                setSize={setSize}
                quality={quality}
                setQuality={setQuality}
                format={format}
                setFormat={setFormat}
                imagesPerPrompt={imagesPerPrompt}
                setImagesPerPrompt={setImagesPerPrompt}
              />

              {isExperimentalResolution(size) && <p className="rounded-2xl bg-primary/12 px-4 py-3 text-sm text-primary">高分辨率可能更慢，且属于实验性输出；如果模型暂不支持，会在队列日志中显示 API 错误。</p>}

              <button
                onClick={submit}
                disabled={submitting || (mode !== "batch" && !prompt.trim()) || (mode === "batch" && !batchText.trim())}
                className="md-ripple inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 font-semibold text-primary-foreground shadow-md3 disabled:opacity-45"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                加入生成队列
              </button>
              <AnimatePresence>
                {notice && <Toast kind="ok" message={notice} onClose={() => setNotice(null)} />}
                {error && <Toast kind="error" message={error} onClose={() => setError(null)} />}
              </AnimatePresence>
            </div>
          </section>

          <CanvasPanel latestImage={latestImage} runningJob={runningJob} imageModel={settings?.imageModel || "gpt-image-1.5"} onReuse={useImageAsReference} />
          <GalleryPanel images={history.images} onReuse={useImageAsReference} />
        </div>
      </div>

      <QueueDrawer open={queueOpen} onClose={() => setQueueOpen(false)} queue={queue} onPatchJob={patchJob} />
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} onSave={saveSettings} />
    </main>
  );
}

function Header({ queueLength, theme, onQueue, onTheme, onSettings }: { queueLength: number; theme: "light" | "dark"; onQueue: () => void; onTheme: () => void; onSettings: () => void }) {
  return (
    <header className="md-surface flex flex-wrap items-center justify-between gap-3 rounded-[1.75rem] px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md3">
          <Wand2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold md:text-xl">Local Image Studio</h1>
          <p className="text-xs text-muted-foreground">SQLite 队列 · 多轮改图 · 本地图库</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onQueue} className="md-ripple inline-flex h-11 items-center gap-2 rounded-full bg-surface-container-high px-4 text-sm">
          <PanelRightOpen className="h-4 w-4" />
          队列 {queueLength > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{queueLength}</span>}
        </button>
        <button onClick={onTheme} className="md-ripple grid h-11 w-11 place-items-center rounded-full bg-surface-container-high">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button onClick={onSettings} className="md-ripple grid h-11 w-11 place-items-center rounded-full bg-surface-container-high">
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

function ModeTabs({ mode, setMode }: { mode: Mode; setMode: (mode: Mode) => void }) {
  const modes: Array<{ value: Mode; label: string; icon: ReactNode }> = [
    { value: "generate", label: "文生图", icon: <Sparkles className="h-4 w-4" /> },
    { value: "edit", label: "图生图", icon: <ImagePlus className="h-4 w-4" /> },
    { value: "chat", label: "连续改图", icon: <Bot className="h-4 w-4" /> },
    { value: "batch", label: "批量", icon: <Layers3 className="h-4 w-4" /> },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {modes.map((item) => (
        <button
          key={item.value}
          onClick={() => setMode(item.value)}
          className={`md-ripple inline-flex h-11 items-center justify-center gap-2 rounded-full text-sm font-medium transition ${mode === item.value ? "bg-primary text-primary-foreground shadow-md3" : "bg-surface-container-high text-foreground"}`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

function ReferenceStrip({ images, onRemove }: { images: ImageAsset[]; onRemove: (id: string) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {images.map((image) => (
        <div key={image.id} className="group relative aspect-square overflow-hidden rounded-2xl bg-surface-container-high">
          <Image src={image.url} alt={image.prompt || "参考图"} fill sizes="96px" unoptimized className="object-cover" />
          <button onClick={() => onRemove(image.id)} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-background/80 opacity-0 transition group-hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function GenerationControls(props: {
  size: ImageSize;
  setSize: (size: ImageSize) => void;
  quality: ImageQuality;
  setQuality: (quality: ImageQuality) => void;
  format: OutputFormat;
  setFormat: (format: OutputFormat) => void;
  imagesPerPrompt: number;
  setImagesPerPrompt: (count: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium">分辨率</p>
        <div className="grid grid-cols-2 gap-2">
          {IMAGE_SIZES.map((item) => (
            <button key={item} onClick={() => props.setSize(item)} className={`md-ripple h-10 rounded-full px-3 text-sm transition ${props.size === item ? "bg-primary text-primary-foreground" : "bg-surface-container-high"}`}>
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <SelectPill label="画质" value={props.quality} values={IMAGE_QUALITIES} onChange={(value) => props.setQuality(value)} />
        <SelectPill label="格式" value={props.format} values={OUTPUT_FORMATS} onChange={(value) => props.setFormat(value)} />
        <label className="text-sm font-medium">
          每条张数
          <select value={props.imagesPerPrompt} onChange={(event) => props.setImagesPerPrompt(Number(event.target.value))} className="mt-2 h-11 w-full rounded-full border border-border bg-surface px-3">
            {[1, 2, 3, 4].map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function SelectPill<T extends string>({ label, value, values, onChange }: { label: string; value: T; values: readonly T[]; onChange: (value: T) => void }) {
  return (
    <label className="text-sm font-medium">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value as T)} className="mt-2 h-11 w-full rounded-full border border-border bg-surface px-3">
        {values.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </label>
  );
}

function CanvasPanel({ latestImage, runningJob, imageModel, onReuse }: { latestImage: ImageAsset | null; runningJob: QueueJob | null; imageModel: string; onReuse: (image: ImageAsset, mode?: Mode) => void }) {
  return (
    <section className="md-surface min-h-[720px] rounded-[2rem] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">当前画布</h2>
          <p className="text-sm text-muted-foreground">{runningJob ? `正在处理：${runningJob.prompt.slice(0, 28)}` : "最新生成结果会出现在这里"}</p>
        </div>
        <span className="rounded-full bg-surface-container-high px-3 py-1 text-xs text-muted-foreground">{imageModel}</span>
      </div>
      <div className="grid min-h-[620px] place-items-center rounded-[1.75rem] bg-surface-container-high p-3">
        <AnimatePresence mode="wait">
          {runningJob ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-xl space-y-4">
              <div className="aspect-square rounded-[2rem] shimmer" />
              <div className="mx-auto h-3 w-2/3 rounded-full shimmer" />
              <div className="mx-auto h-3 w-1/2 rounded-full shimmer" />
            </motion.div>
          ) : latestImage ? (
            <motion.div key={latestImage.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="w-full max-w-3xl">
              <Image src={latestImage.url} alt={latestImage.prompt || "生成图"} width={1400} height={1400} unoptimized className="mx-auto max-h-[68vh] w-auto rounded-[2rem] object-contain shadow-md3" />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-surface/80 p-3">
                <p className="line-clamp-2 text-sm text-muted-foreground">{latestImage.prompt}</p>
                <ImageActions image={latestImage} onReuse={onReuse} />
              </div>
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
              <Sparkles className="mx-auto mb-4 h-10 w-10 text-primary" />
              <h3 className="text-xl font-semibold">准备好第一张图片</h3>
              <p className="mt-2 text-sm text-muted-foreground">输入 prompt 或上传参考图开始。</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function GalleryPanel({ images, onReuse }: { images: ImageAsset[]; onReuse: (image: ImageAsset, mode?: Mode) => void }) {
  return (
    <section className="md-surface rounded-[2rem] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">历史图库</h2>
          <p className="text-sm text-muted-foreground">生成、上传与批次归档</p>
        </div>
        <GalleryHorizontalEnd className="h-5 w-5 text-primary" />
      </div>
      <div className="grid max-h-[730px] grid-cols-2 gap-3 overflow-auto pr-1">
        {images.length === 0 ? (
          <div className="col-span-2 rounded-3xl bg-surface-container-high p-5 text-sm text-muted-foreground">暂无历史图片。</div>
        ) : (
          images.map((image) => <GalleryCard key={image.id} image={image} onReuse={onReuse} />)
        )}
      </div>
    </section>
  );
}

function Toast({ kind, message, onClose }: { kind: "ok" | "error"; message: string; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm ${kind === "ok" ? "bg-tertiary/12 text-tertiary" : "bg-error/12 text-error"}`}>
      {message}
      <button onClick={onClose}>
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

function ImageActions({ image, onReuse }: { image: ImageAsset; onReuse: (image: ImageAsset, mode?: Mode) => void }) {
  return (
    <div className="flex items-center gap-2">
      <a href={image.url} download className="md-ripple grid h-10 w-10 place-items-center rounded-full bg-surface-container-high">
        <Download className="h-4 w-4" />
      </a>
      <button onClick={() => void navigator.clipboard.writeText(image.prompt || "")} className="md-ripple grid h-10 w-10 place-items-center rounded-full bg-surface-container-high">
        <Copy className="h-4 w-4" />
      </button>
      <button onClick={() => onReuse(image, "chat")} className="md-ripple inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground">
        <RotateCcw className="h-4 w-4" />
        继续编辑
      </button>
    </div>
  );
}

function GalleryCard({ image, onReuse }: { image: ImageAsset; onReuse: (image: ImageAsset, mode?: Mode) => void }) {
  return (
    <motion.div whileHover={{ y: -4, scale: 1.015 }} className="group overflow-hidden rounded-3xl bg-surface-container-high shadow-md3">
      <div className="relative aspect-square overflow-hidden">
        <Image src={image.url} alt={image.prompt || "历史图片"} fill sizes="180px" unoptimized className="object-cover transition duration-500 group-hover:scale-105" />
        <span className="absolute left-2 top-2 rounded-full bg-background/75 px-2 py-1 text-[11px]">{image.kind}</span>
      </div>
      <div className="space-y-3 p-3">
        <p className="line-clamp-2 min-h-10 text-xs text-muted-foreground">{image.prompt || "本地图片"}</p>
        <ImageActions image={image} onReuse={onReuse} />
      </div>
    </motion.div>
  );
}

function QueueDrawer({ open, onClose, queue, onPatchJob }: { open: boolean; onClose: () => void; queue: QueueResponse; onPatchJob: (id: string, action: "cancel" | "retry") => void }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-40 bg-black/35" />
          <motion.aside initial={{ x: 420 }} animate={{ x: 0 }} exit={{ x: 420 }} transition={{ type: "spring", damping: 30, stiffness: 260 }} className="fixed right-0 top-0 z-50 h-full w-full max-w-[420px] overflow-auto bg-surface p-4 shadow-md3">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">本地队列</h2>
                <p className="text-sm text-muted-foreground">SQLite worker 正在轮询消费任务</p>
              </div>
              <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-surface-container-high">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {["queued", "running", "completed"].map((status) => (
                <div key={status} className="rounded-3xl bg-surface-container p-3 text-center">
                  <div className="text-xl font-semibold">{queue.counts[status] || 0}</div>
                  <div className="text-xs text-muted-foreground">{statusLabel(status)}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              {queue.jobs.map((job) => (
                <div key={job.id} className="rounded-3xl bg-surface-container p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs ${statusClass(job.status)}`}>{statusLabel(job.status)}</span>
                    <span className="text-xs text-muted-foreground">{job.type}</span>
                  </div>
                  <p className="line-clamp-2 text-sm">{job.prompt}</p>
                  {job.error && <p className="mt-2 rounded-2xl bg-error/10 px-3 py-2 text-xs text-error">{job.error}</p>}
                  <div className="mt-3 flex gap-2">
                    {(job.status === "queued" || job.status === "running") && (
                      <button onClick={() => onPatchJob(job.id, "cancel")} className="md-ripple inline-flex h-9 items-center gap-1 rounded-full bg-surface-container-high px-3 text-xs">
                        <Trash2 className="h-3.5 w-3.5" />
                        取消
                      </button>
                    )}
                    {(job.status === "failed" || job.status === "canceled") && (
                      <button onClick={() => onPatchJob(job.id, "retry")} className="md-ripple inline-flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-xs text-primary-foreground">
                        <RefreshCw className="h-3.5 w-3.5" />
                        重试
                      </button>
                    )}
                  </div>
                  {job.logs?.[0] && (
                    <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      {job.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                      {job.logs[0].message}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function SettingsDrawer({ open, onClose, settings, onSave }: { open: boolean; onClose: () => void; settings: AppSettings | null; onSave: (settings: Partial<AppSettings> & { apiKey?: string }) => Promise<void> }) {
  const [apiKey, setApiKey] = useState("");
  const [imageModel, setImageModel] = useState(settings?.imageModel || "gpt-image-1.5");
  const [responsesModel, setResponsesModel] = useState(settings?.responsesModel || "gpt-5");
  const [maxConcurrency, setMaxConcurrency] = useState(settings?.maxConcurrency || 1);

  useEffect(() => {
    if (!settings) return;
    setImageModel(settings.imageModel);
    setResponsesModel(settings.responsesModel);
    setMaxConcurrency(settings.maxConcurrency);
  }, [settings]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-40 bg-black/35" />
          <motion.aside initial={{ x: 440 }} animate={{ x: 0 }} exit={{ x: 440 }} transition={{ type: "spring", damping: 30, stiffness: 260 }} className="fixed right-0 top-0 z-50 h-full w-full max-w-[440px] overflow-auto bg-surface p-5 shadow-md3">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">设置</h2>
                <p className="text-sm text-muted-foreground">API Key、模型和本地队列参数</p>
              </div>
              <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-surface-container-high">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <Field label="本地 API Key">
                <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} type="password" placeholder={settings?.apiKeySource === "env" ? "正在使用环境变量 OPENAI_API_KEY" : "sk-..."} className="h-12 w-full rounded-2xl border border-border bg-surface-container px-4 outline-none focus:border-primary" />
              </Field>
              <Field label="Images API 模型">
                <input value={imageModel} onChange={(event) => setImageModel(event.target.value)} className="h-12 w-full rounded-2xl border border-border bg-surface-container px-4 outline-none focus:border-primary" />
              </Field>
              <Field label="Responses API 模型">
                <input value={responsesModel} onChange={(event) => setResponsesModel(event.target.value)} className="h-12 w-full rounded-2xl border border-border bg-surface-container px-4 outline-none focus:border-primary" />
              </Field>
              <Field label="worker 最大并发">
                <select value={maxConcurrency} onChange={(event) => setMaxConcurrency(Number(event.target.value))} className="h-12 w-full rounded-2xl border border-border bg-surface-container px-4">
                  {[1, 2, 3].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="rounded-3xl bg-surface-container p-4 text-sm leading-7 text-muted-foreground">
                生成文件保存到 <strong>{settings?.generatedDir || "public/generated"}</strong>。环境变量优先级高于数据库 API Key。
              </div>
              <button onClick={() => void onSave({ apiKey, imageModel, responsesModel, maxConcurrency }).then(onClose)} className="md-ripple h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground">
                保存设置
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      <span className="mb-2 block">{label}</span>
      {children}
    </label>
  );
}
