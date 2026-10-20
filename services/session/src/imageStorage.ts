
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";

const STORAGE_ROOT = resolve(
  process.env.THRESHOLD_IMAGE_STORAGE_PATH ??
    "../../.local/threshold/images",
);

export type ImageMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/webp";

const EXTENSIONS: Record<ImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function detectImageType(
  buffer: Buffer,
): ImageMimeType | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    )
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

function resolveStorageKey(storageKey: string): string {
  const path = resolve(STORAGE_ROOT, storageKey);

  if (!path.startsWith(STORAGE_ROOT + sep)) {
    throw new Error("invalid_storage_key");
  }

  return path;
}

export async function saveImage(
  buffer: Buffer,
  sessionCode: string,
  scanGroupId: string,
  mimeType: ImageMimeType,
): Promise<string> {
  const extension = EXTENSIONS[mimeType];

  const storageKey = [
    "calibration",
    sessionCode,
    scanGroupId,
    `${randomUUID()}.${extension}`,
  ].join("/");

  const path = resolveStorageKey(storageKey);

  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, buffer, { flag: "wx" });

  return storageKey;
}

export async function readImage(
  storageKey: string,
): Promise<Buffer> {
  return readFile(resolveStorageKey(storageKey));
}

export async function removeImage(
  storageKey: string,
): Promise<void> {
  await rm(resolveStorageKey(storageKey), { force: true });
}
