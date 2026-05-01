export type ImageSize = "1024x1024" | "1536x1024" | "1024x1536";
export type ImageQuality = "low" | "medium" | "high" | "auto";
export type OutputFormat = "png" | "jpeg" | "webp";

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  createdAt: string;
  size: ImageSize;
  quality: ImageQuality;
  format: OutputFormat;
}
