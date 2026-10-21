
import type { Server } from "node:net";
import { acquireDevelopmentLock } from "./developmentLock.js";

const PORT = Number(process.env.PORT ?? 3001);

let developmentLock: Server | undefined;

try {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.NODE_ENV !== "test" &&
    process.env.THRESHOLD_LOCK_HELD_BY_LAUNCHER !== "1"
  ) {
    developmentLock = await acquireDevelopmentLock();
  }

  const { app } = await import("./app.js");

  const server = app.listen(PORT, "0.0.0.0", () => {
    const address = server.address();

    if (address && typeof address !== "string") {
      console.log(
        `Threshold session service listening on port ${address.port}`
      );
    }
  });

  server.on("error", (error) => {
    console.error("Threshold backend failed to start:", error);
    developmentLock?.close();
    process.exitCode = 1;
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      server.close(() => {
        developmentLock?.close();
        process.exit(0);
      });
    });
  }
} catch (error) {
  console.error("Threshold backend startup failed:", error);
  developmentLock?.close();
  process.exitCode = 1;
}
