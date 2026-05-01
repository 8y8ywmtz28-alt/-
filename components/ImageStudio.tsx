"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ImageGallery } from "@/components/ImageGallery";
import { ImageUploader } from "@/components/ImageUploader";
import { PromptComposer } from "@/components/PromptComposer";
import { GenerationSettings } from "@/components/GenerationSettings";
import { Card } from "@/components/ui/card";
import { GeneratedImage, ImageQuality, ImageSize, OutputFormat } from "@/types";

export function ImageStudio() {
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState<ImageSize>("1024x1024");
  const [quality, setQuality] = useState<ImageQuality>("auto");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("png");

  const submit = async () => {
    setLoading(true); setError(null);
    try {
      const endpoint = files.length ? "/api/images/edit" : "/api/images/generate";
      let response: Response;
      if (files.length) {
        const form = new FormData();
        form.append("prompt", prompt); form.append("size", size); form.append("quality", quality); form.append("output_format", outputFormat);
        files.forEach((f) => form.append("images", f));
        response = await fetch(endpoint, { method: "POST", body: form });
      } else {
        response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, size, quality, output_format: outputFormat }) });
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "生成失败");
      setImages((p) => [data.image, ...p]);
      setFiles([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "请求失败");
    } finally { setLoading(false); }
  };

  return (
    <main className="container py-8 space-y-6">
      <h1 className="text-3xl font-semibold">AI 图片生成工作台</h1>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card className="p-4 space-y-4">
          <GenerationSettings size={size} quality={quality} outputFormat={outputFormat} onSizeChange={setSize} onQualityChange={setQuality} onFormatChange={setOutputFormat} />
          <ImageUploader onFiles={setFiles} />
          <PromptComposer prompt={prompt} setPrompt={setPrompt} onSubmit={submit} loading={loading} />
          {loading && <motion.div className="h-2 rounded bg-primary" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.2 }} />}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 text-lg font-medium">生成历史 / 画廊</h2>
          {images.length === 0 ? <p className="text-sm text-muted-foreground">暂无图片，开始创建吧。</p> : <ImageGallery images={images} onReuse={(img) => setPrompt(img.prompt)} />}
        </Card>
      </div>
    </main>
  );
}
