export const IMAGE_SIZES = [
  "1024x1024",
  "1536x1024",
  "1024x1536",
  "2048x2048",
  "2048x1152",
  "3840x2160",
  "2160x3840",
  "auto",
] as const;

export const IMAGE_QUALITIES = ["low", "medium", "high", "auto"] as const;
export const OUTPUT_FORMATS = ["png", "jpeg", "webp"] as const;
export const JOB_STATUSES = ["queued", "running", "completed", "failed", "canceled"] as const;
export const JOB_TYPES = ["generate", "edit", "chat"] as const;

export type ImageSize = (typeof IMAGE_SIZES)[number];
export type ImageQuality = (typeof IMAGE_QUALITIES)[number];
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];
export type JobStatus = (typeof JOB_STATUSES)[number];
export type JobType = (typeof JOB_TYPES)[number];

export interface GeneratedImage {
  id: string;
  url: string;
  filePath?: string;
  kind: string;
  prompt?: string | null;
  createdAt: string;
  size?: ImageSize | string | null;
  quality?: ImageQuality | string | null;
  format?: OutputFormat | string | null;
  batchId?: string | null;
  conversationId?: string | null;
  jobId?: string | null;
}

export interface QueueJob {
  id: string;
  type: JobType | string;
  status: JobStatus | string;
  prompt: string;
  error?: string | null;
  attempts: number;
  batchId?: string | null;
  conversationId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  hasApiKey: boolean;
  apiKeySource: "env" | "database" | "missing";
  imageModel: string;
  responsesModel: string;
  defaultSize: ImageSize;
  defaultQuality: ImageQuality;
  defaultFormat: OutputFormat;
  maxConcurrency: number;
  generatedDir: string;
}
