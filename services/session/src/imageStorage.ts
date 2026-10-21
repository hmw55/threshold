import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const STORAGE_ROOT = resolve(
  process.env.THRESHOLD_IMAGE_STORAGE_PATH ??
    "../../.local/threshold/images",
);

const S3_BUCKET = process.env.THRESHOLD_S3_BUCKET;

const s3 = S3_BUCKET ? new S3Client({}) : null;

function validateStorageKey(storageKey: string): void {
  if (
    !/^calibration\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9-]+\.(jpg|png|webp)$/.test(
      storageKey,
    )
  ) {
    throw new Error("invalid_storage_key");
  }
}

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

  if (S3_BUCKET && s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: storageKey,
        Body: buffer,
        ContentType: mimeType,
      }),
    );

    return storageKey;
  }

  const path = resolveStorageKey(storageKey);

  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, buffer, { flag: "wx" });

  return storageKey;
}

export async function readImage(
  storageKey: string,
): Promise<Buffer> {
  validateStorageKey(storageKey);

  if (S3_BUCKET && s3) {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: storageKey,
      }),
    );

    if (!response.Body) {
      throw new Error("image_body_missing");
    }

    return Buffer.from(await response.Body.transformToByteArray());
  }

  return readFile(resolveStorageKey(storageKey));
}

export async function removeImage(
  storageKey: string,
): Promise<void> {
  validateStorageKey(storageKey);

  if (S3_BUCKET && s3) {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: storageKey,
      }),
    );

    return;
  }

  await rm(resolveStorageKey(storageKey), { force: true });
}
