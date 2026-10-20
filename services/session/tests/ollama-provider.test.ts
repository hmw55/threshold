import { afterEach, describe, expect, it, vi } from "vitest";
import { OllamaProvider } from "../src/architect/ollamaProvider.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OllamaProvider", () => {
  it("sends a generation request to local Ollama", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          response: "The bookshelf holds a clue.",
          model: "gemma3:4b",
          done: true,
        }),
        { status: 200 },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const provider = new OllamaProvider();

    const result = await provider.generate({
      systemPrompt: "You are the Architect.",
      userPrompt: "Describe the observed room.",
      temperature: 0.4,
      maxOutputTokens: 256,
    });

    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, options] = fetchMock.mock.calls[0]!;

    expect(url).toBe("http://127.0.0.1:11434/api/generate");

    const body = JSON.parse(options.body as string);

    expect(body).toMatchObject({
      model: "gemma3:4b",
      system: "You are the Architect.",
      prompt: "Describe the observed room.",
      stream: false,
      think: false,
      options: {
        temperature: 0.4,
        num_predict: 256,
      },
    });

    expect(result).toEqual({
      text: "The bookshelf holds a clue.",
      provider: "ollama",
      model: "gemma3:4b",
    });
  });

  it("reports connection failures without falling back to Bedrock", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Connection refused")),
    );

    const provider = new OllamaProvider();

    await expect(
      provider.generate({
        systemPrompt: "You are the Architect.",
        userPrompt: "Begin.",
      }),
    ).rejects.toThrow("Local Ollama request failed: Connection refused");
  });

  it("rejects unsuccessful HTTP responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    );

    const provider = new OllamaProvider();

    await expect(
      provider.generate({
        systemPrompt: "You are the Architect.",
        userPrompt: "Begin.",
      }),
    ).rejects.toThrow("Local Ollama returned HTTP 503");
  });

  it("rejects malformed generation responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ response: "Incomplete" }), {
          status: 200,
        }),
      ),
    );

    const provider = new OllamaProvider();

    await expect(
      provider.generate({
        systemPrompt: "You are the Architect.",
        userPrompt: "Begin.",
      }),
    ).rejects.toThrow(
      "Local Ollama returned an invalid generation response",
    );
  });

  it("rejects empty generation responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: "",
          model: "gemma3:4b",
          done: true,
          done_reason: "length",
        }),
      }),
    );

    const provider = new OllamaProvider();

    await expect(
      provider.generate({
        systemPrompt: "You are the Architect.",
        userPrompt: "Describe the room.",
      }),
    ).rejects.toThrow(
      "Local Ollama returned an empty generation response",
    );
  });
});