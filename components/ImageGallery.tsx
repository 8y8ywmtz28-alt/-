"use client";
import Image from "next/image";
import { GeneratedImage } from "@/types";
import { Button } from "@/components/ui/button";

export function ImageGallery({ images, onReuse }: { images: GeneratedImage[]; onReuse: (img: GeneratedImage) => void }) {
  return <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{images.map((img) => <div key={img.id} className="rounded-xl border border-border bg-card p-3"><div className="relative aspect-square overflow-hidden rounded-lg"><Image src={img.url} alt={img.prompt} fill className="object-cover" /></div><p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{img.prompt}</p><div className="mt-3 flex gap-2"><a href={img.url} download className="flex-1"><Button className="w-full bg-transparent border border-border">下载</Button></a><Button className="bg-transparent border border-border" onClick={() => navigator.clipboard.writeText(img.prompt)}>复制</Button><Button onClick={() => onReuse(img)}>继续编辑</Button></div></div>)}</div>;
}
