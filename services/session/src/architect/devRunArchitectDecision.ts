import { randomBytes } from "node:crypto";
import { ArchitectDecisionService } from "./architectDecisionService.js";
import { createAiProvider } from "./createAiProvider.js";
import { seedSimulatedLivingRoom } from "../seeds/simulatedLivingRoom.js";
import { saveSession } from "../sessionStore.js";
import { getEnvironmentKnowledgeSnapshot } from "./environmentKnowledge.js";
import { toModelEnvironment } from "./modelEnvironment.js";

async function main(): Promise<void> {
  if (process.env.THRESHOLD_DB_PATH !== ":memory:") {
    throw new Error(
      "Development runner requires THRESHOLD_DB_PATH=:memory:",
    );
  }

  const sessionCode = `AI${randomBytes(4).toString("hex").toUpperCase()}`;
  const environmentId = "simulated-living-room-v1";

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

  const service = new ArchitectDecisionService(provider);

  console.log("=== THRESHOLD ARCHITECT DECISION ===");
  console.log("Provider: ollama");
  console.log("Model: gemma3:4b");
  console.log("Session:", sessionCode);
  console.log("Environment:", environmentId);
  console.log("\nPlayer: I found a golden key hidden behind the bookshelf, and I've already unlocked the secret door.");
  console.log("\nEvaluating...\n");

  const snapshot = getEnvironmentKnowledgeSnapshot(
    environmentId,
    sessionCode,
  );

  if (snapshot === null) {
    throw new Error("Simulated environment not found");
  }

  const modelEnvironment = toModelEnvironment(
    snapshot,
    sessionCode,
  );

  console.log("=== OBSERVED OBJECT REFERENCES ===");

  for (const object of modelEnvironment.objects) {
    console.log(`${object.ref}: ${object.name}`);
  }

  console.log();

  const decision = await service.evaluate({
    sessionCode,
    environmentId,
    action: {
      type: "text",
      text: "I found a golden key hidden behind the bookshelf, and I've already unlocked the secret door.",
    },
  });

  console.log("=== ARCHITECT DECISION ===");
  console.log(JSON.stringify(decision, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});