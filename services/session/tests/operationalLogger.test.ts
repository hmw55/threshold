import { afterEach, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "threshold-log-test-"));
const logPath = join(directory, "events.jsonl");

afterEach(() => {
  vi.resetModules();
});

it("writes only approved operational metadata", async () => {
  vi.stubEnv("THRESHOLD_OPERATIONAL_LOG_PATH", logPath);

  const { logOperationalEvent } = await import("../src/operationalLogger.js");

  logOperationalEvent("info", {
    event: "calibration.analysis.completed",
    durationMs: 1250,
    objectCount: 4,
  });

  const record = JSON.parse(readFileSync(logPath, "utf8").trim());

  expect(record.event).toBe("calibration.analysis.completed");
  expect(record.durationMs).toBe(1250);
  expect(record.objectCount).toBe(4);
  expect(record).not.toHaveProperty("image");
  expect(record).not.toHaveProperty("message");
});

it("rejects unexpected event names", async () => {
  const rejectedPath = join(directory, "rejected.jsonl");
  vi.stubEnv("THRESHOLD_OPERATIONAL_LOG_PATH", rejectedPath);

  const { logOperationalEvent } = await import("../src/operationalLogger.js");

  logOperationalEvent("info", {
    event: "private.player.message" as "session.created",
  });

  expect(() => readFileSync(rejectedPath, "utf8")).toThrow();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

process.on("exit", () => {
  rmSync(directory, { recursive: true, force: true });
});
