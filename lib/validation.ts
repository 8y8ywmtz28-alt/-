import { z } from "zod";
import { IMAGE_QUALITIES, IMAGE_SIZES, OUTPUT_FORMATS } from "../types";

export const imageSizeSchema = z.enum(IMAGE_SIZES);
export const imageQualitySchema = z.enum(IMAGE_QUALITIES);
export const outputFormatSchema = z.enum(OUTPUT_FORMATS);

export const generationSchema = z.object({
  prompt: z.string().trim().min(1, "请输入 prompt").optional(),
  prompts: z.array(z.string().trim().min(1)).max(50).optional(),
  count: z.number().int().min(1).max(10).default(1),
  size: imageSizeSchema.default("1024x1024"),
  quality: imageQualitySchema.default("auto"),
  output_format: outputFormatSchema.default("png"),
  batchName: z.string().trim().max(80).optional(),
});

export const editJsonSchema = z.object({
  prompt: z.string().trim().min(1),
  imageAssetIds: z.array(z.string()).min(1).max(16),
  size: imageSizeSchema.default("1024x1024"),
  quality: imageQualitySchema.default("auto"),
  output_format: outputFormatSchema.default("png"),
});

export const chatSchema = z.object({
  conversationId: z.string().optional(),
  prompt: z.string().trim().min(1),
  imageAssetIds: z.array(z.string()).max(16).default([]),
  size: imageSizeSchema.default("1024x1024"),
  quality: imageQualitySchema.default("auto"),
  output_format: outputFormatSchema.default("png"),
});

export const settingsSchema = z.object({
  apiKey: z.string().optional(),
  imageModel: z.string().trim().min(1).optional(),
  responsesModel: z.string().trim().min(1).optional(),
  defaultSize: imageSizeSchema.optional(),
  defaultQuality: imageQualitySchema.optional(),
  defaultFormat: outputFormatSchema.optional(),
  maxConcurrency: z.number().int().min(1).max(3).optional(),
});
