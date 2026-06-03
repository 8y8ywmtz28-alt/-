import type { GenerationBatch, GenerationJob, ImageAsset, QueueLog, Conversation, ConversationMessage } from "@prisma/client";
import { safeJson } from "./queue";

export function serializeImage(image: ImageAsset) {
  return {
    ...image,
    params: safeJson<Record<string, unknown>>(image.paramsJson, {}),
    createdAt: image.createdAt.toISOString(),
  };
}

export function serializeJob(job: GenerationJob & { logs?: QueueLog[]; images?: ImageAsset[] }) {
  return {
    ...job,
    params: safeJson<Record<string, unknown>>(job.paramsJson, {}),
    referenceImageUrls: safeJson<string[]>(job.referenceImageUrls, []),
    resultImageIds: safeJson<string[]>(job.resultImageIds, []),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    canceledAt: job.canceledAt?.toISOString() ?? null,
    logs: job.logs?.map(serializeLog),
    images: job.images?.map(serializeImage),
  };
}

export function serializeBatch(batch: GenerationBatch & { jobs?: GenerationJob[]; images?: ImageAsset[] }) {
  return {
    ...batch,
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString(),
    jobs: batch.jobs?.map((job) => serializeJob(job)),
    images: batch.images?.map(serializeImage),
  };
}

export function serializeLog(log: QueueLog) {
  return {
    ...log,
    meta: safeJson<Record<string, unknown>>(log.metaJson, {}),
    createdAt: log.createdAt.toISOString(),
  };
}

export function serializeConversation(conversation: Conversation & { messages?: (ConversationMessage & { imageAsset?: ImageAsset | null })[]; images?: ImageAsset[] }) {
  return {
    ...conversation,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    messages: conversation.messages?.map((message) => ({
      ...message,
      metadata: safeJson<Record<string, unknown>>(message.metadataJson, {}),
      createdAt: message.createdAt.toISOString(),
      imageAsset: message.imageAsset ? serializeImage(message.imageAsset) : null,
    })),
    images: conversation.images?.map(serializeImage),
  };
}
