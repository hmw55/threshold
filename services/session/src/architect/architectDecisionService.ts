import type { AiProvider } from "./aiProvider.js";
import type {
  ArchitectDecision,
  PlayerAction,
} from "./architectActions.js";
import { buildArchitectDecisionPrompt } from "./architectDecisionPrompt.js";
import { getEnvironmentKnowledgeSnapshot } from "./environmentKnowledge.js";
import { toModelEnvironment } from "./modelEnvironment.js";
import { parseArchitectDecision } from "./parseArchitectDecision.js";

export class ArchitectDecisionService {
  constructor(private readonly provider: AiProvider) {}

  async evaluate(input: {
    sessionCode: string;
    environmentId: string;
    action: PlayerAction;
  }): Promise<ArchitectDecision> {
    const snapshot = getEnvironmentKnowledgeSnapshot(
    input.environmentId,
    input.sessionCode,
    );

    if (snapshot === null) {
    throw new Error(
        `Environment not found: ${input.environmentId}`,
    );
    }

    const environment = toModelEnvironment(
    snapshot,
    input.sessionCode,
    );

    const allowedObjectRefs = new Set(
      environment.objects.map((object) => object.ref),
    );

    const prompt = buildArchitectDecisionPrompt(
      environment,
      input.action,
    );

    const generation = await this.provider.generate(prompt);

    if (process.env.THRESHOLD_DB_PATH === ":memory:") {
      console.log("\n=== RAW ARCHITECT RESPONSE ===");
      console.log(generation.text);
      console.log("=== END RAW RESPONSE ===\n");
    }

    const decision = parseArchitectDecision(
      generation.text,
      allowedObjectRefs,
    );

    // AI effects are proposals only. This service never mutates game state.
    // The calling game route must explicitly authorize each proposed effect.
    return decision;
  }
}