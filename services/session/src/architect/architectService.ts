import type {
  AiGenerationResponse,
  AiProvider,
} from "./aiProvider.js";

import { buildArchitectPrompt } from "./architectPrompt.js";
import { getEnvironmentKnowledgeSnapshot } from "./environmentKnowledge.js";
import { toModelEnvironment } from "./modelEnvironment.js";

export interface ArchitectGenerationRequest {
  sessionCode: string;
  environmentId: string;
  playerRequest: string;
}

export interface ArchitectServiceOptions {
  provider: AiProvider;
}

export class ArchitectService {
  private readonly provider: AiProvider;

  constructor(options: ArchitectServiceOptions) {
    this.provider = options.provider;
  }

  async generate(
    request: ArchitectGenerationRequest,
  ): Promise<AiGenerationResponse> {
    const snapshot = getEnvironmentKnowledgeSnapshot(
      request.environmentId,
      request.sessionCode,
    );

    if (!snapshot) {
      throw new Error(
        `Environment not found: ${request.environmentId}`,
      );
    }

    const modelEnvironment = toModelEnvironment(
      snapshot,
      request.sessionCode,
    );

    const prompt = buildArchitectPrompt(
      modelEnvironment,
      request.playerRequest,
    );

    return this.provider.generate(prompt);
  }
}