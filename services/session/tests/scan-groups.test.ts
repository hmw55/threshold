
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app, resetSessionsForTesting } from "../src/app.js";
import {
  createScanGroup,
  getScanGroup,
  listScanGroups,
  type ScanGroup,
} from "../src/sessionStore.js";

describe("Scan group persistence", () => {
  beforeEach(() => {
    resetSessionsForTesting();
  });

  async function createExpedition(deviceId = "tv-1") {
    const response = await request(app)
      .post("/sessions")
      .send({ deviceId })
      .expect(201);

    return response.body;
  }

  function makeScanGroup(
    sessionCode: string,
    overrides: Partial<ScanGroup> = {}
  ): ScanGroup {
    return {
      id: randomUUID(),
      sessionCode,
      thresholdId: null,
      label: "KITCHEN",
      createdBy: "operative-1",
      status: "pending",
      createdAt: new Date().toISOString(),
      ...overrides,
    };
  }

  it("creates and retrieves a scan group", async () => {
    const session = await createExpedition();
    const group = makeScanGroup(session.code);

    createScanGroup(group);

    expect(getScanGroup(group.id)).toEqual({
      ...group,
      claimedBy: group.createdBy,
      claimExpiresAt: null,
    });

    expect(listScanGroups(session.code)).toEqual([
      {
        ...group,
        claimedBy: group.createdBy,
        claimExpiresAt: null,
      },
    ]);
  });

  it("associates scan groups with Fire TV zones", async () => {
    const session = await createExpedition();

    const thresholdId = session.thresholds[0].id as string;

    const group = makeScanGroup(session.code, {
      thresholdId,
      label: "THE NEXUS",
    });

    createScanGroup(group);

    expect(getScanGroup(group.id)?.thresholdId).toBe(thresholdId);
    expect(getScanGroup(group.id)?.label).toBe("THE NEXUS");
  });

  it("supports multiple additional areas without TVs", async () => {
    const session = await createExpedition();

    const kitchen = makeScanGroup(session.code, {
      label: "KITCHEN",
    });

    const hallway = makeScanGroup(session.code, {
      label: "HALLWAY",
    });

    createScanGroup(kitchen);
    createScanGroup(hallway);

    const groups = listScanGroups(session.code);

    expect(groups).toHaveLength(2);
    expect(groups.every((group) => group.thresholdId === null)).toBe(true);
    expect(groups.map((group) => group.label).sort()).toEqual([
      "HALLWAY",
      "KITCHEN",
    ]);
  });

  it("keeps scan groups isolated between expeditions", async () => {
    const first = await createExpedition("tv-1");
    const second = await createExpedition("tv-2");

    const group = makeScanGroup(first.code);

    createScanGroup(group);

    expect(listScanGroups(first.code)).toHaveLength(1);
    expect(listScanGroups(second.code)).toHaveLength(0);
  });

  it("preserves scans when one of multiple TVs leaves", async () => {
    const session = await createExpedition("tv-1");

    await request(app)
      .post(`/sessions/${session.code}/thresholds`)
      .send({ deviceId: "tv-2" })
      .expect(201);

    const group = makeScanGroup(session.code, {
      thresholdId: session.thresholds[0].id,
      label: "THE NEXUS",
    });

    createScanGroup(group);

    await request(app)
      .delete(`/sessions/${session.code}/thresholds/tv-1`)
      .expect(200);

    expect(getScanGroup(group.id)).toEqual({
      ...group,
      claimedBy: group.createdBy,
      claimExpiresAt: null,
    });
  });

  it("deletes scan groups when the expedition closes", async () => {
    const session = await createExpedition();

    const group = makeScanGroup(session.code);

    createScanGroup(group);

    await request(app)
      .delete(`/sessions/${session.code}/thresholds/tv-1`)
      .expect(200);

    expect(getScanGroup(group.id)).toBeNull();
    expect(listScanGroups(session.code)).toEqual([]);
  });
});
