import { randomUUID } from "node:crypto";

import { ArchitectService } from "./architectService.js";
import { createAiProvider } from "./createAiProvider.js";

import {
  seedSimulatedLivingRoom,
  SIMULATED_LIVING_ROOM_ID,
} from "../seeds/simulatedLivingRoom.js";

import { saveSession } from "../sessionStore.js";

async function main(): Promise<void> {
  // Always use a temporary in-memory database for this demo.
  if (process.env.THRESHOLD_DB_PATH !== ":memory:") {
    throw new Error(
      "This runner requires THRESHOLD_DB_PATH=:memory:",
    );
  }

  const sessionCode = `AI${randomUUID()
    .replaceAll("-", "")
    .slice(0, 8)
    .toUpperCase()}`;

  seedSimulatedLivingRoom();

  saveSession(sessionCode, {
    code: sessionCode,
    status: "test",
  });

  const provider = createAiProvider({
    provider: "ollama",
    ollamaModel: "gemma3:4b",
    ollamaTimeoutMs: 180_000,
  });

  const architect = new ArchitectService({ provider });

  console.log("=== THRESHOLD ARCHITECT ===");
  console.log("Provider:", provider.name);
  console.log("Session:", sessionCode);
  console.log("Environment:", SIMULATED_LIVING_ROOM_ID);
  console.log("\nGenerating...\n");

  const result = await architect.generate({
    sessionCode,
    environmentId: SIMULATED_LIVING_ROOM_ID,
    playerRequest: [
      "You are preparing a mysterious adventure for this room.",
      "Describe a compelling opening scene in 100 words or fewer.",
      "Use only objects that have actually been observed.",
      "Do not invent specific contents of collections.",
      "Do not reveal any puzzle solutions yet.",
    ].join(" "),
  });

  console.log("Model:", result.model);
  console.log("\n=== ARCHITECT RESPONSE ===\n");
  console.log(result.text);
}

main().catch((error: unknown) => {
  console.error("Architect generation failed:", error);
  process.exitCode = 1;
});