"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function PromptComposer({ prompt, setPrompt, onSubmit, loading }: { prompt: string; setPrompt: (v: string) => void; onSubmit: () => void; loading: boolean; }) {
  return (
    <div className="space-y-3">
      <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="描述你想生成或编辑的图片..." className="min-h-[140px]" />
      <Button onClick={onSubmit} disabled={loading || !prompt.trim()} className="w-full">{loading ? "生成中..." : "生成图片"}</Button>
    </div>
  );
}
