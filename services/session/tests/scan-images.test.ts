
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSessions,
  saveSession,
  createScanGroup,
  createScanImage,
  listScanImages,
  countScanImages,
  deleteScanImage,
} from "../src/sessionStore.js";

describe("Scan image persistence", () => {
  beforeEach(() => {
    clearSessions();

    saveSession("TEST01", {
      code: "TEST01",
      players: [],
      thresholds: [],
      status: "awaiting_players",
      phase: "lobby",
    });

    createScanGroup({
      id: "group-1",
      sessionCode: "TEST01",
      thresholdId: null,
      label: "KITCHEN",
      createdBy: "player-1",
      claimedBy: "player-1",
      claimExpiresAt: null,
      status: "pending",
      createdAt: "2026-10-09T12:00:00.000Z",
    });
  });

  function makeImage(id: string) {
    return {
      id,
      scanGroupId: "group-1",
      storageKey: `calibration/TEST01/group-1/${id}.jpg`,
      mimeType: "image/jpeg" as const,
      sizeBytes: 2048,
      createdAt: "2026-10-09T12:00:00.000Z",
    };
  }

  it("creates and retrieves image metadata", () => {
    const image = makeImage("image-1");

    expect(createScanImage(image, "player-1")).toEqual(image);
    expect(listScanImages("group-1")).toEqual([image]);
  });

  it("only allows the player claiming a scan to add images", () => {
    const image = makeImage("image-1");

    expect(() =>
      createScanImage(image, "player-2"),
    ).toThrow("scan_claim_not_owned");

    expect(countScanImages("group-1")).toBe(0);
    expect(listScanImages("group-1")).toEqual([]);

    expect(createScanImage(image, "player-1")).toEqual(image);

    expect(countScanImages("group-1")).toBe(1);
    expect(listScanImages("group-1")).toEqual([image]);
  });

  it("supports multiple images in one scan group", () => {
    createScanImage(makeImage("image-1"), "player-1");
    createScanImage(makeImage("image-2"), "player-1");
    createScanImage(makeImage("image-3"), "player-1");

    expect(countScanImages("group-1")).toBe(3);
    expect(listScanImages("group-1")).toHaveLength(3);
  });

  it("returns an empty list for a group without images", () => {
    expect(listScanImages("group-1")).toEqual([]);
    expect(countScanImages("group-1")).toBe(0);
  });

  it("deletes individual image metadata", () => {
    createScanImage(makeImage("image-1"), "player-1");
    createScanImage(makeImage("image-2"), "player-1");

    deleteScanImage("image-1");

    expect(countScanImages("group-1")).toBe(1);
    expect(listScanImages("group-1")[0]?.id).toBe("image-2");
  });

  it("rejects duplicate storage keys", () => {
    createScanImage(makeImage("image-1"), "player-1");

    expect(() =>
      createScanImage(
        {
          ...makeImage("image-2"),
          storageKey: makeImage("image-1").storageKey,
        },
        "player-1",
      ),
    ).toThrow();
  });

  it("rejects image metadata for nonexistent groups", () => {
    expect(() =>
      createScanImage(
        {
          ...makeImage("image-1"),
          scanGroupId: "missing-group",
        },
        "player-1",
      ),
    ).toThrow("scan_group_not_found");
  });

  it("rejects image metadata exceeding 10 MB", () => {
    expect(() =>
      createScanImage(
        {
          ...makeImage("image-1"),
          sizeBytes: 10 * 1024 * 1024 + 1,
        },
        "player-1",
      ),
    ).toThrow();
  });

  it("rejects unsupported image formats", () => {
    expect(() =>
      createScanImage(
        {
          ...makeImage("image-1"),
          mimeType: "image/gif" as "image/jpeg",
        },
        "player-1",
      ),
    ).toThrow();
  });

  it("cascades image deletion when an expedition is cleared", () => {
    createScanImage(makeImage("image-1"), "player-1");

    clearSessions();

    expect(listScanImages("group-1")).toEqual([]);
  });
});
