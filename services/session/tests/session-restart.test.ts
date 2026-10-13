import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, describe, expect, it } from "vitest";

const serviceDirectory = resolve(import.meta.dirname, "..");
const serverEntry = resolve(serviceDirectory, "src/index.ts");
const tsxCli = resolve(serviceDirectory, "node_modules/tsx/dist/cli.mjs");

let server: ChildProcess | undefined;
let temporaryDirectory: string | undefined;

async function startServer(databasePath: string): Promise<string> {
  const child = spawn(
    process.execPath,
    [tsxCli, serverEntry],
    {
      cwd: serviceDirectory,
      env: {
        ...process.env,
        NODE_ENV: "test",
        THRESHOLD_DB_PATH: databasePath,
        PORT: "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  server = child;

  let output = "";
  let errors = "";

  child.stdout?.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });

  child.stderr?.on("data", (chunk: Buffer) => {
    errors += chunk.toString();
  });

  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    const match = output.match(
      /Threshold session service listening on port (\d+)/
    );

    if (match) {
      return `http://127.0.0.1:${match[1]}`;
    }

    if (child.exitCode !== null) {
      throw new Error(`Backend exited:\n${errors}`);
    }

    await delay(50);
  }

  throw new Error(`Backend startup timed out:\n${output}\n${errors}`);
}

async function stopServer(): Promise<void> {
  const child = server;
  server = undefined;

  if (!child) return;

  if (child.exitCode !== null) return;

  child.kill("SIGTERM");

  await Promise.race([
    new Promise<void>((resolveDone) => {
      child.once("exit", () => resolveDone());
    }),
    delay(5_000).then(() => {
      child.kill("SIGKILL");
    }),
  ]);
}

afterEach(async () => {
  await stopServer();

  if (temporaryDirectory) {
    rmSync(temporaryDirectory, {
      recursive: true,
      force: true,
    });
    temporaryDirectory = undefined;
  }
});

describe("Session persistence across backend restarts", () => {
  it("restores an expedition with its players and TVs", async () => {
    temporaryDirectory = mkdtempSync(
      join(tmpdir(), "threshold-restart-")
    );

    const databasePath = join(
      temporaryDirectory,
      "sessions.sqlite"
    );

    const firstUrl = await startServer(databasePath);

    const createResponse = await fetch(`${firstUrl}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "fire-tv-001" }),
    });

    expect(createResponse.status).toBe(201);

    const session = await createResponse.json() as {
      code: string;
    };

    const joinResponse = await fetch(
      `${firstUrl}/sessions/${session.code}/join`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Mack" }),
      }
    );

    expect(joinResponse.status).toBe(201);

    await stopServer();

    const secondUrl = await startServer(databasePath);

    const restoredResponse = await fetch(
      `${secondUrl}/sessions/${session.code}`
    );

    expect(restoredResponse.status).toBe(200);

    const restored = await restoredResponse.json() as {
      players: Array<{ name: string }>;
      thresholds: Array<{ deviceId: string }>;
    };

    expect(restored.players).toHaveLength(1);
    expect(restored.players[0]?.name).toBe("Mack");
    expect(restored.thresholds).toHaveLength(1);
    expect(restored.thresholds[0]?.deviceId).toBe("fire-tv-001");
  });

  it("does not restore an expedition deleted before restart", async () => {
    temporaryDirectory = mkdtempSync(
      join(tmpdir(), "threshold-restart-")
    );

    const databasePath = join(
      temporaryDirectory,
      "sessions.sqlite"
    );

    const firstUrl = await startServer(databasePath);

    const createResponse = await fetch(`${firstUrl}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "fire-tv-001" }),
    });

    expect(createResponse.status).toBe(201);

    const session = await createResponse.json() as {
      code: string;
    };

    const leaveResponse = await fetch(
      `${firstUrl}/sessions/${session.code}/thresholds/fire-tv-001`,
      { method: "DELETE" }
    );

    expect(leaveResponse.status).toBe(200);

    await stopServer();

    const secondUrl = await startServer(databasePath);

    const restoredResponse = await fetch(
      `${secondUrl}/sessions/${session.code}`
    );

    expect(restoredResponse.status).toBe(404);
  });
});
