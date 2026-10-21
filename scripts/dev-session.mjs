
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const mode = process.argv[2];

const DATABASE_LOCK_PORT = 43187;

if (!["resume", "fresh"].includes(mode)) {
  console.error("Usage: node scripts/dev-session.mjs <resume|fresh>");
  process.exit(1);
}

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run local development commands in production.");
  process.exit(1);
}

const databasePath = resolve(
  root,
  ".local/threshold/sessions.sqlite"
);

const lockServer = createServer();

try {
  await new Promise((resolveLock, rejectLock) => {
    lockServer.once("error", rejectLock);
    lockServer.listen(
      DATABASE_LOCK_PORT,
      "127.0.0.1",
      resolveLock
    );
  });
} catch (error) {
  if (error.code === "EADDRINUSE") {
    console.error(
      "Another Threshold development launcher is already running. " +
      "Stop it before starting a new session or clearing the database."
    );
  } else {
    console.error("Unable to acquire development lock:", error);
  }

  process.exit(1);
}

if (mode === "fresh") {
  rmSync(databasePath, { force: true });
  rmSync(`${databasePath}-wal`, { force: true });
  rmSync(`${databasePath}-shm`, { force: true });

  console.log("Cleared local Threshold expedition database.");
} else {
  console.log("Preserving local Threshold expeditions.");
}

mkdirSync(dirname(databasePath), { recursive: true });

const child = spawn(
  "pnpm",
  ["--filter", "@threshold/session", "dev"],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "development",
      THRESHOLD_DB_PATH: databasePath,
      PORT: process.env.PORT ?? "3001",
      THRESHOLD_LOCK_HELD_BY_LAUNCHER: "1",
    },
  }
);

let stopping = false;

function shutdown(signal) {
  if (stopping) return;
  stopping = true;

  child.kill(signal);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(signal));
}

child.on("exit", (code, signal) => {
  lockServer.close();
  process.exitCode = code ?? (signal ? 1 : 0);
});

child.on("error", (error) => {
  console.error("Failed to start Threshold backend:", error);
  lockServer.close();
  process.exitCode = 1;
});
