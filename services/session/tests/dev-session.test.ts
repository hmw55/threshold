
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../.."
);

const launcher = resolve(root, "scripts/dev-session.mjs");

interface LauncherResult {
  code: number | null;
  stderr: string;
}

function runLauncher(
  mode: string,
  environment: NodeJS.ProcessEnv = process.env
): Promise<LauncherResult> {
  return new Promise((resolveResult, rejectResult) => {
    const childProcess = spawn(
      process.execPath,
      [launcher, mode],
      {
        cwd: root,
        env: environment,
        stdio: ["ignore", "ignore", "pipe"],
      }
    );

    let stderr = "";

    childProcess.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    childProcess.once("error", rejectResult);

    childProcess.once("close", (code) => {
      resolveResult({ code, stderr });
    });
  });
}

describe("Local development launcher", () => {
  it("rejects production mode before touching the database", async () => {
    const result = await runLauncher("fresh", {
      ...process.env,
      NODE_ENV: "production",
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(
      "Refusing to run local development commands in production."
    );
  });

  it("rejects an invalid startup mode", async () => {
    const result = await runLauncher("invalid");

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Usage:");
  });
});
