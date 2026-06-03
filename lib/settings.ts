import { prisma } from "./prisma";
import { parseImageQuality, parseImageSize, parseOutputFormat } from "./image-options";
import type { AppSettings } from "../types";

const DEFAULT_GENERATED_DIR = "public/generated";

export async function getSettingValue(key: string) {
  const setting = await prisma.setting.findUnique({ where: { key } });
  return setting?.value ?? null;
}

export async function setSettingValue(key: string, value: string) {
  return prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function getApiKey() {
  const envKey = process.env.OPENAI_API_KEY?.trim();
  if (envKey) {
    return { apiKey: envKey, source: "env" as const };
  }

  const dbKey = (await getSettingValue("openaiApiKey"))?.trim();
  if (dbKey) {
    return { apiKey: dbKey, source: "database" as const };
  }

  return { apiKey: null, source: "missing" as const };
}

export async function hasConfiguredApiKey() {
  const { apiKey } = await getApiKey();
  return Boolean(apiKey);
}

export async function getAppSettings(): Promise<AppSettings> {
  const { apiKey, source } = await getApiKey();
  const [imageModel, responsesModel, defaultSize, defaultQuality, defaultFormat, maxConcurrency] = await Promise.all([
    getSettingValue("imageModel"),
    getSettingValue("responsesModel"),
    getSettingValue("defaultSize"),
    getSettingValue("defaultQuality"),
    getSettingValue("defaultFormat"),
    getSettingValue("maxConcurrency"),
  ]);

  return {
    hasApiKey: Boolean(apiKey),
    apiKeySource: source,
    imageModel: imageModel || process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5",
    responsesModel: responsesModel || process.env.OPENAI_RESPONSES_MODEL || "gpt-5",
    defaultSize: parseImageSize(defaultSize, "1024x1024"),
    defaultQuality: parseImageQuality(defaultQuality, "auto"),
    defaultFormat: parseOutputFormat(defaultFormat, "png"),
    maxConcurrency: Math.min(Math.max(Number(maxConcurrency || 1), 1), 3),
    generatedDir: DEFAULT_GENERATED_DIR,
  };
}

export async function saveAppSettings(input: {
  apiKey?: string;
  imageModel?: string;
  responsesModel?: string;
  defaultSize?: string;
  defaultQuality?: string;
  defaultFormat?: string;
  maxConcurrency?: number;
}) {
  const writes: Promise<unknown>[] = [];

  if (input.apiKey !== undefined && input.apiKey.trim()) {
    writes.push(setSettingValue("openaiApiKey", input.apiKey.trim()));
  }
  if (input.imageModel) writes.push(setSettingValue("imageModel", input.imageModel.trim()));
  if (input.responsesModel) writes.push(setSettingValue("responsesModel", input.responsesModel.trim()));
  if (input.defaultSize) writes.push(setSettingValue("defaultSize", parseImageSize(input.defaultSize).toString()));
  if (input.defaultQuality) writes.push(setSettingValue("defaultQuality", parseImageQuality(input.defaultQuality).toString()));
  if (input.defaultFormat) writes.push(setSettingValue("defaultFormat", parseOutputFormat(input.defaultFormat).toString()));
  if (input.maxConcurrency) writes.push(setSettingValue("maxConcurrency", String(Math.min(Math.max(input.maxConcurrency, 1), 3))));

  await Promise.all(writes);
  return getAppSettings();
}
