import type { AiProvider } from "./aiProvider.js";
import { OllamaProvider } from "./ollamaProvider.js";
import { GeminiProvider } from "./geminiProvider.js";

export interface AiProviderConfig {
  provider?: string;
  ollamaUrl?: string;
  ollamaModel?: string;
  ollamaTimeoutMs?: number;
  geminiApiKey?: string;
  geminiModel?: string;
  geminiTimeoutMs?: number;
}

export function createAiProvider(
  config: AiProviderConfig = {},
): AiProvider {
  const provider = config.provider ??
    process.env.THRESHOLD_AI_PROVIDER ??
    "ollama";

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

  if (provider === "gemini") {
    return new GeminiProvider({
      ...(config.geminiApiKey !== undefined
        ? { apiKey: config.geminiApiKey }
        : {}),
      model: config.geminiModel ??
        process.env.GEMINI_MODEL ??
        "gemini-3.5-flash-lite",
      ...(config.geminiTimeoutMs !== undefined
        ? { timeoutMs: config.geminiTimeoutMs }
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