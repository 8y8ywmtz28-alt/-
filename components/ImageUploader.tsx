"use client";

import { useDropzone } from "react-dropzone";

export function ImageUploader({ onFiles }: { onFiles: (files: File[]) => void }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => onFiles(accepted),
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    maxSize: 8 * 1024 * 1024,
  });

  return (
    <div {...getRootProps()} className="rounded-xl border border-dashed border-input p-6 text-center cursor-pointer hover:bg-muted/50 transition">
      <input {...getInputProps()} />
      <p className="text-sm text-muted-foreground">{isDragActive ? "松开上传图片" : "拖拽图片到这里，或点击上传（支持多图）"}</p>
    </div>
  );
}
