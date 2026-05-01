"use client";

import { ImageQuality, ImageSize, OutputFormat } from "@/types";

interface Props {
  size: ImageSize;
  quality: ImageQuality;
  outputFormat: OutputFormat;
  onSizeChange: (v: ImageSize) => void;
  onQualityChange: (v: ImageQuality) => void;
  onFormatChange: (v: OutputFormat) => void;
}

export function GenerationSettings({ size, quality, outputFormat, onSizeChange, onQualityChange, onFormatChange }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <select className="rounded-md border border-input bg-card px-3 py-2" value={size} onChange={(e) => onSizeChange(e.target.value as ImageSize)}>
        <option value="1024x1024">1024x1024</option><option value="1536x1024">1536x1024</option><option value="1024x1536">1024x1536</option>
      </select>
      <select className="rounded-md border border-input bg-card px-3 py-2" value={quality} onChange={(e) => onQualityChange(e.target.value as ImageQuality)}>
        <option value="auto">auto</option><option value="low">low</option><option value="medium">medium</option><option value="high">high</option>
      </select>
      <select className="rounded-md border border-input bg-card px-3 py-2" value={outputFormat} onChange={(e) => onFormatChange(e.target.value as OutputFormat)}>
        <option value="png">png</option><option value="jpeg">jpeg</option><option value="webp">webp</option>
      </select>
    </div>
  );
}
