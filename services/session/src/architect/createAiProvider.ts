import type { AiProvider } from "./aiProvider.js";
import { OllamaProvider } from "./ollamaProvider.js";

export interface AiProviderConfig {
  provider?: string;
  ollamaUrl?: string;
  ollamaModel?: string;
  ollamaTimeoutMs?: number;
}

export function createAiProvider(
  config: AiProviderConfig = {},
): AiProvider {
  const provider = config.provider ?? "ollama";

  if (provider === "ollama") {
    return new OllamaProvider({
      ...(config.ollamaUrl !== undefined
        ? { baseUrl: config.ollamaUrl }
        : {}),

      ...(config.ollamaModel !== undefined
        ? { model: config.ollamaModel }
        : {}),

      ...(config.ollamaTimeoutMs !== undefined
        ? { timeoutMs: config.ollamaTimeoutMs }
        : {}),
    });
  }

  if (provider === "bedrock") {
    throw new Error(
      "AWS Bedrock is not implemented. " +
      "Use Ollama for local development.",
    );
  }

  throw new Error(`Unsupported AI provider: ${provider}`);
}