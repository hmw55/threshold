import { describe, expect, it } from "vitest";

import { createAiProvider } from "../src/architect/createAiProvider.js";
import { OllamaProvider } from "../src/architect/ollamaProvider.js";

describe("AI provider selection", () => {
  it("defaults to local Ollama", () => {
    const provider = createAiProvider();

    expect(provider).toBeInstanceOf(OllamaProvider);
    expect(provider.name).toBe("ollama");
  });

  it("allows Ollama to be selected explicitly", () => {
    const provider = createAiProvider({
      provider: "ollama",
    });

    expect(provider).toBeInstanceOf(OllamaProvider);
    expect(provider.name).toBe("ollama");
  });

  it("accepts custom Ollama configuration", async () => {
    const provider = createAiProvider({
      provider: "ollama",
      ollamaUrl: "http://127.0.0.1:11435",
      ollamaModel: "test-model",
      ollamaTimeoutMs: 5_000,
    });

    expect(provider).toBeInstanceOf(OllamaProvider);
    expect(provider.name).toBe("ollama");
  });

  it("rejects Bedrock because it is not implemented", () => {
    expect(() =>
      createAiProvider({
        provider: "bedrock",
      }),
    ).toThrow("AWS Bedrock is not implemented");
  });

  it("rejects unknown providers", () => {
    expect(() =>
      createAiProvider({
        provider: "openai",
      }),
    ).toThrow("Unsupported AI provider: openai");
  });
});