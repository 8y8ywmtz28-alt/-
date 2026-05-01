import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

export async function saveBase64Image(base64: string, format: string) {
  const buffer = Buffer.from(base64, "base64");
  const ext = format === "jpeg" ? "jpg" : format;
  const filename = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const directory = path.join(process.cwd(), "public", "generated");
  const filePath = path.join(directory, filename);
  await mkdir(directory, { recursive: true });
  await writeFile(filePath, buffer);
  return `/generated/${filename}`;
}
