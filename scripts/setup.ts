import "dotenv/config";
import path from "path";
import { prisma } from "../lib/prisma";

process.on("warning", (warning) => {
  if (warning.name !== "ExperimentalWarning") {
    console.warn(warning);
  }
});

interface DatabaseLike {
  exec: (sql: string) => void;
  close: () => void;
}

function resolveSqlitePath() {
  const url = process.env.DATABASE_URL || "file:./dev.db";
  if (!url.startsWith("file:")) {
    throw new Error("This local setup script expects DATABASE_URL to use SQLite file: URLs.");
  }

  const raw = url.replace(/^file:/, "");
  if (path.isAbsolute(raw)) return raw;

  // Prisma's common SQLite convention resolves file:./dev.db next to prisma/schema.prisma.
  return path.join(process.cwd(), "prisma", raw);
}

async function createDatabase() {
  const sqlite = (await import("node:sqlite")) as unknown as {
    DatabaseSync: new (filename: string) => DatabaseLike;
  };
  const dbPath = resolveSqlitePath();
  const db = new sqlite.DatabaseSync(dbPath);

  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS "Setting" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "key" TEXT NOT NULL UNIQUE,
      "value" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "GenerationBatch" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "mode" TEXT NOT NULL DEFAULT 'single',
      "status" TEXT NOT NULL DEFAULT 'queued',
      "promptCount" INTEGER NOT NULL DEFAULT 1,
      "imagesPerPrompt" INTEGER NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "Conversation" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "title" TEXT NOT NULL,
      "previousResponseId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "GenerationJob" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "type" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'queued',
      "prompt" TEXT NOT NULL,
      "paramsJson" TEXT NOT NULL DEFAULT '{}',
      "referenceImageUrls" TEXT NOT NULL DEFAULT '[]',
      "resultImageIds" TEXT NOT NULL DEFAULT '[]',
      "error" TEXT,
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "maxAttempts" INTEGER NOT NULL DEFAULT 2,
      "batchId" TEXT,
      "conversationId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "startedAt" DATETIME,
      "completedAt" DATETIME,
      "canceledAt" DATETIME
    );

    CREATE TABLE IF NOT EXISTS "ImageAsset" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "url" TEXT NOT NULL,
      "filePath" TEXT NOT NULL,
      "kind" TEXT NOT NULL DEFAULT 'generated',
      "prompt" TEXT,
      "paramsJson" TEXT NOT NULL DEFAULT '{}',
      "size" TEXT,
      "quality" TEXT,
      "format" TEXT,
      "batchId" TEXT,
      "conversationId" TEXT,
      "jobId" TEXT,
      "sourceImageId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "ConversationMessage" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "conversationId" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "imageAssetId" TEXT,
      "responseId" TEXT,
      "metadataJson" TEXT NOT NULL DEFAULT '{}',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "QueueLog" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "jobId" TEXT NOT NULL,
      "level" TEXT NOT NULL DEFAULT 'info',
      "message" TEXT NOT NULL,
      "metaJson" TEXT NOT NULL DEFAULT '{}',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS "GenerationJob_status_createdAt_idx" ON "GenerationJob"("status", "createdAt");
    CREATE INDEX IF NOT EXISTS "GenerationJob_batchId_idx" ON "GenerationJob"("batchId");
    CREATE INDEX IF NOT EXISTS "GenerationJob_conversationId_idx" ON "GenerationJob"("conversationId");
    CREATE INDEX IF NOT EXISTS "ImageAsset_createdAt_idx" ON "ImageAsset"("createdAt");
    CREATE INDEX IF NOT EXISTS "ImageAsset_batchId_idx" ON "ImageAsset"("batchId");
    CREATE INDEX IF NOT EXISTS "ImageAsset_conversationId_idx" ON "ImageAsset"("conversationId");
    CREATE INDEX IF NOT EXISTS "ImageAsset_jobId_idx" ON "ImageAsset"("jobId");
    CREATE INDEX IF NOT EXISTS "ConversationMessage_conversationId_createdAt_idx" ON "ConversationMessage"("conversationId", "createdAt");
    CREATE INDEX IF NOT EXISTS "QueueLog_jobId_createdAt_idx" ON "QueueLog"("jobId", "createdAt");
  `);

  db.close();
}

async function seedDefaults() {
  const defaults = {
    imageModel: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5",
    responsesModel: process.env.OPENAI_RESPONSES_MODEL || "gpt-5",
    defaultSize: "1024x1024",
    defaultQuality: "auto",
    defaultFormat: "png",
    maxConcurrency: "1",
  };

  await Promise.all(
    Object.entries(defaults).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value },
        update: {},
      }),
    ),
  );
}

async function main() {
  await createDatabase();
  if (!process.argv.includes("--migrate-only")) {
    await seedDefaults();
  }

  if (!process.argv.includes("--quiet")) {
    console.log("");
    console.log("AI Image Studio is ready.");
    console.log("Run: npm run dev");
    console.log("Open: http://localhost:3000");
    console.log("");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
