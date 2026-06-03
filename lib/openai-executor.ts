import type { GenerationJob } from "@prisma/client";
import type { ImageEditParamsNonStreaming, ImageGenerateParamsNonStreaming } from "openai/resources/images";
import { prisma } from "./prisma";
import { getOpenAIClient } from "./openai";
import { getApiKey, getAppSettings } from "./settings";
import { toApiImageSize, isExperimentalResolution, parseImageQuality, parseImageSize, parseOutputFormat } from "./image-options";
import { addQueueLog, refreshBatchStatus, safeJson } from "./queue";
import { filePathToDataUrl, filePathToUpload, publicPathToFilePath, saveBase64Image } from "./storage";
import type { ImageQuality, ImageSize, OutputFormat } from "../types";

interface JobParams {
  size?: ImageSize | string;
  quality?: ImageQuality | string;
  output_format?: OutputFormat | string;
  imageModel?: string;
  responsesModel?: string;
  sourceImageIds?: string[];
}

interface ResponseWithOutput {
  id: string;
  output?: unknown[];
}

interface ImageGenerationCall {
  id?: string;
  type: "image_generation_call";
  result?: string;
  revised_prompt?: string;
}

function isImageGenerationCall(value: unknown): value is ImageGenerationCall {
  return typeof value === "object" && value !== null && "type" in value && (value as { type?: unknown }).type === "image_generation_call";
}

function normalizeParams(paramsJson: string, defaults: { size: ImageSize; quality: ImageQuality; format: OutputFormat }) {
  const params = safeJson<JobParams>(paramsJson, {});
  return {
    params,
    size: parseImageSize(params.size, defaults.size),
    quality: parseImageQuality(params.quality, defaults.quality),
    format: parseOutputFormat(params.output_format, defaults.format),
  };
}

async function throwIfCanceled(jobId: string) {
  const latest = await prisma.generationJob.findUnique({ where: { id: jobId }, select: { status: true } });
  if (latest?.status === "canceled") {
    throw new Error("任务已取消");
  }
}

async function createResultAsset(input: {
  b64: string;
  prompt: string;
  size: ImageSize;
  quality: ImageQuality;
  format: OutputFormat;
  job: GenerationJob;
  kind?: string;
  sourceImageId?: string | null;
}) {
  const stored = await saveBase64Image(input.b64, input.format);
  return prisma.imageAsset.create({
    data: {
      url: stored.url,
      filePath: stored.filePath,
      kind: input.kind || "generated",
      prompt: input.prompt,
      paramsJson: JSON.stringify({ size: input.size, quality: input.quality, output_format: input.format }),
      size: input.size,
      quality: input.quality,
      format: input.format,
      batchId: input.job.batchId,
      conversationId: input.job.conversationId,
      jobId: input.job.id,
      sourceImageId: input.sourceImageId || null,
    },
  });
}

async function runGenerate(job: GenerationJob) {
  const appSettings = await getAppSettings();
  const { apiKey } = await getApiKey();
  const client = getOpenAIClient(apiKey);
  if (!client) throw new Error("未配置 OpenAI API Key");

  const { params, size, quality, format } = normalizeParams(job.paramsJson, {
    size: appSettings.defaultSize,
    quality: appSettings.defaultQuality,
    format: appSettings.defaultFormat,
  });
  const model = params.imageModel || appSettings.imageModel;

  if (isExperimentalResolution(size)) {
    await addQueueLog(job.id, `已请求实验性高分辨率 ${size}，如果模型不支持会返回 API 错误。`, "warn");
  }

  const request = {
    model,
    prompt: job.prompt,
    size: toApiImageSize(size),
    quality,
    output_format: format,
  } as unknown as ImageGenerateParamsNonStreaming;

  await addQueueLog(job.id, `调用 Images API：${model} / ${size} / ${quality} / ${format}`);
  const result = await client.images.generate(request);
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error("模型未返回图片");
  await throwIfCanceled(job.id);

  const asset = await createResultAsset({ b64, prompt: job.prompt, size, quality, format, job, kind: "generated" });
  await prisma.generationJob.update({
    where: { id: job.id },
    data: { status: "completed", completedAt: new Date(), resultImageIds: JSON.stringify([asset.id]), error: null },
  });
  await addQueueLog(job.id, "图片生成完成", "success", { imageId: asset.id });
}

async function runEdit(job: GenerationJob) {
  const appSettings = await getAppSettings();
  const { apiKey } = await getApiKey();
  const client = getOpenAIClient(apiKey);
  if (!client) throw new Error("未配置 OpenAI API Key");

  const { params, size, quality, format } = normalizeParams(job.paramsJson, {
    size: appSettings.defaultSize,
    quality: appSettings.defaultQuality,
    format: appSettings.defaultFormat,
  });
  const model = params.imageModel || appSettings.imageModel;
  const referenceUrls = safeJson<string[]>(job.referenceImageUrls, []);
  if (referenceUrls.length === 0) throw new Error("改图任务缺少参考图");

  const uploaded = await Promise.all(referenceUrls.map((url) => filePathToUpload(publicPathToFilePath(url))));
  if (isExperimentalResolution(size)) {
    await addQueueLog(job.id, `已请求实验性高分辨率 ${size}，如果模型不支持会返回 API 错误。`, "warn");
  }

  const request = {
    model,
    prompt: job.prompt,
    image: uploaded,
    size: toApiImageSize(size),
    quality,
    output_format: format,
  } as unknown as ImageEditParamsNonStreaming;

  await addQueueLog(job.id, `调用 Images Edit API：${model} / ${referenceUrls.length} 张参考图`);
  const result = await client.images.edit(request);
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error("模型未返回图片");
  await throwIfCanceled(job.id);

  const sourceImageId = params.sourceImageIds?.[0] || null;
  const asset = await createResultAsset({ b64, prompt: job.prompt, size, quality, format, job, kind: "edited", sourceImageId });
  await prisma.generationJob.update({
    where: { id: job.id },
    data: { status: "completed", completedAt: new Date(), resultImageIds: JSON.stringify([asset.id]), error: null },
  });
  await addQueueLog(job.id, "图片编辑完成", "success", { imageId: asset.id });
}

async function runChat(job: GenerationJob) {
  const appSettings = await getAppSettings();
  const { apiKey } = await getApiKey();
  const client = getOpenAIClient(apiKey);
  if (!client) throw new Error("未配置 OpenAI API Key");
  if (!job.conversationId) throw new Error("聊天式改图任务缺少 conversationId");

  const conversation = await prisma.conversation.findUnique({ where: { id: job.conversationId } });
  if (!conversation) throw new Error("会话不存在");

  const { params, size, quality, format } = normalizeParams(job.paramsJson, {
    size: appSettings.defaultSize,
    quality: appSettings.defaultQuality,
    format: appSettings.defaultFormat,
  });
  const model = params.responsesModel || appSettings.responsesModel;
  const referenceUrls = safeJson<string[]>(job.referenceImageUrls, []);
  const imageInputs = await Promise.all(referenceUrls.map((url) => filePathToDataUrl(publicPathToFilePath(url))));
  const content = [
    { type: "input_text", text: job.prompt },
    ...imageInputs.map((imageUrl) => ({ type: "input_image", image_url: imageUrl })),
  ];

  await addQueueLog(job.id, `调用 Responses API：${model} + image_generation`);
  const response = (await client.responses.create({
    model,
    previous_response_id: conversation.previousResponseId || undefined,
    input: [{ role: "user", content }],
    tools: [
      {
        type: "image_generation",
        size: toApiImageSize(size),
        quality,
        output_format: format,
        action: "auto",
      },
    ],
    tool_choice: { type: "image_generation" },
  } as Parameters<typeof client.responses.create>[0])) as unknown as ResponseWithOutput;

  const imageCall = response.output?.find(isImageGenerationCall);
  if (!imageCall?.result) throw new Error("Responses API 未返回图片");
  await throwIfCanceled(job.id);

  const sourceImageId = params.sourceImageIds?.[0] || null;
  const asset = await createResultAsset({ b64: imageCall.result, prompt: job.prompt, size, quality, format, job, kind: "chat", sourceImageId });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      previousResponseId: response.id,
      messages: {
        create: {
          role: "assistant",
          content: imageCall.revised_prompt || "已生成新图片",
          responseId: response.id,
          imageAssetId: asset.id,
          metadataJson: JSON.stringify({ imageGenerationCallId: imageCall.id }),
        },
      },
    },
  });
  await prisma.generationJob.update({
    where: { id: job.id },
    data: { status: "completed", completedAt: new Date(), resultImageIds: JSON.stringify([asset.id]), error: null },
  });
  await addQueueLog(job.id, "聊天式改图完成", "success", { imageId: asset.id, responseId: response.id });
}

export async function executeGenerationJob(job: GenerationJob) {
  try {
    if (job.status === "canceled") return;

    if (job.type === "generate") await runGenerate(job);
    else if (job.type === "edit") await runEdit(job);
    else if (job.type === "chat") await runChat(job);
    else throw new Error(`未知任务类型：${job.type}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "任务执行失败";
    const latest = await prisma.generationJob.findUnique({ where: { id: job.id }, select: { status: true } });
    if (latest?.status === "canceled") {
      await addQueueLog(job.id, "worker 已停止写入取消任务的结果", "warn");
      return;
    }
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: "failed", error: message, completedAt: new Date() },
    });
    await addQueueLog(job.id, message, "error");
  } finally {
    await refreshBatchStatus(job.batchId);
  }
}
