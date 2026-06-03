import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import type { OutputFormat } from "../types";

const GENERATED_ROOT = path.join(process.cwd(), "public", "generated");
const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

function todayPath() {
  return new Date().toISOString().slice(0, 10);
}

function randomName(ext: string) {
  return `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
}

export function publicPathToFilePath(url: string) {
  return path.join(process.cwd(), "public", url.replace(/^\//, ""));
}

export function extensionForFormat(format: string) {
  return format === "jpeg" ? "jpg" : format;
}

export function mimeFromPath(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

export async function saveBase64Image(base64: string, format: OutputFormat | string, folder = todayPath()) {
  const ext = extensionForFormat(format);
  const directory = path.join(GENERATED_ROOT, folder);
  const filename = randomName(ext);
  const filePath = path.join(directory, filename);
  await mkdir(directory, { recursive: true });
  await writeFile(filePath, Buffer.from(base64, "base64"));
  return {
    url: `/generated/${folder}/${filename}`,
    filePath,
  };
}

export async function saveUploadedFile(file: File, folder = todayPath()) {
  const originalExt = path.extname(file.name).replace(".", "").toLowerCase();
  const ext = originalExt || extensionForFormat(file.type.split("/")[1] || "png");
  const directory = path.join(UPLOAD_ROOT, folder);
  const filename = randomName(ext);
  const filePath = path.join(directory, filename);
  await mkdir(directory, { recursive: true });
  await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
  return {
    url: `/uploads/${folder}/${filename}`,
    filePath,
  };
}

export async function filePathToDataUrl(filePath: string) {
  const buffer = await readFile(filePath);
  return `data:${mimeFromPath(filePath)};base64,${buffer.toString("base64")}`;
}

export async function filePathToUpload(filePath: string) {
  const buffer = await readFile(filePath);
  return new File([buffer], path.basename(filePath), { type: mimeFromPath(filePath) });
}
