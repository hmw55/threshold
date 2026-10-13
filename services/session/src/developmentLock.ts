
import { createServer, type Server } from "node:net";

const DEVELOPMENT_LOCK_PORT = 43187;

export async function acquireDevelopmentLock(): Promise<Server> {
  const server = createServer();

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);

      server.listen(DEVELOPMENT_LOCK_PORT, "127.0.0.1", () => {
        server.removeListener("error", reject);
        resolve();
      });
    });
  } catch (error) {
    server.close();

    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "EADDRINUSE"
    ) {
      throw new Error(
        "Another Threshold development backend is already running."
      );
    }

    throw error;
  }

  return server;
}
