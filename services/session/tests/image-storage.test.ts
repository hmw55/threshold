
import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  detectImageType,
  saveImage,
  readImage,
  removeImage,
} from "../src/imageStorage.js";

describe("Private image storage", () => {
  const createdKeys: string[] = [];

  afterEach(async () => {
    await Promise.all(
      createdKeys.splice(0).map((key) => removeImage(key)),
    );
  });

  it("recognizes JPEG signatures", () => {
    const buffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10,
    ]);

    expect(detectImageType(buffer)).toBe("image/jpeg");
  });

  it("recognizes PNG signatures", () => {
    const buffer = Buffer.from([
      137, 80, 78, 71, 13, 10, 26, 10,
    ]);

    expect(detectImageType(buffer)).toBe("image/png");
  });

  it("recognizes WebP signatures", () => {
    const buffer = Buffer.from(
      "RIFF1234WEBP",
      "ascii",
    );

    expect(detectImageType(buffer)).toBe("image/webp");
  });

  it("rejects unsupported file signatures", () => {
    expect(
      detectImageType(Buffer.from("not an image")),
    ).toBeNull();
  });

  it("saves and reads image bytes without modification", async () => {
    const original = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10,
    ]);

    const key = await saveImage(
      original,
      "TEST01",
      randomUUID(),
      "image/jpeg",
    );

    createdKeys.push(key);

    expect(key).toMatch(
      /^calibration\/TEST01\/[a-f0-9-]+\/[a-f0-9-]+\.jpg$/,
    );

    const restored = await readImage(key);

    expect(restored.equals(original)).toBe(true);
  });

  it("deletes stored photographs", async () => {
    const key = await saveImage(
      Buffer.from([0xff, 0xd8, 0xff]),
      "TEST01",
      randomUUID(),
      "image/jpeg",
    );

    createdKeys.push(key);

    await removeImage(key);

    await expect(readImage(key)).rejects.toThrow();
  });

  it("rejects storage paths outside the private directory", async () => {
    await expect(
      readImage("../../outside.jpg"),
    ).rejects.toThrow("invalid_storage_key");

    await expect(
      removeImage("../outside.jpg"),
    ).rejects.toThrow("invalid_storage_key");
  });
});
