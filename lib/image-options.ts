import { IMAGE_QUALITIES, IMAGE_SIZES, OUTPUT_FORMATS, type ImageQuality, type ImageSize, type OutputFormat } from "../types";

export const API_NATIVE_IMAGE_SIZES = ["1024x1024", "1536x1024", "1024x1536", "auto"] as const;
export type ApiNativeImageSize = (typeof API_NATIVE_IMAGE_SIZES)[number];

function isOption<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

export function parseImageSize(value: unknown, fallback: ImageSize = "1024x1024"): ImageSize {
  return isOption(value, IMAGE_SIZES) ? value : fallback;
}

export function parseImageQuality(value: unknown, fallback: ImageQuality = "auto"): ImageQuality {
  return isOption(value, IMAGE_QUALITIES) ? value : fallback;
}

export function parseOutputFormat(value: unknown, fallback: OutputFormat = "png"): OutputFormat {
  return isOption(value, OUTPUT_FORMATS) ? value : fallback;
}

export function isExperimentalResolution(size: ImageSize) {
  return size === "2048x2048" || size === "2048x1152" || size === "3840x2160" || size === "2160x3840";
}

export function isNativeImageSize(size: ImageSize): size is ApiNativeImageSize {
  return (API_NATIVE_IMAGE_SIZES as readonly string[]).includes(size);
}

export function toApiImageSize(size: ImageSize): string {
  return size;
}
