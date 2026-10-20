import type {
  AiGenerationRequest,
  AiGenerationResponse,
  AiProvider,
} from "./aiProvider.js";

const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL = "gemma3:4b";
const DEFAULT_TIMEOUT_MS = 60_000;

interface OllamaGenerateResponse {
  response: string;
  model: string;
  done: boolean;
  done_reason?: string;
}

export class OllamaProvider implements AiProvider {
  readonly name = "ollama" as const;

  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options: {
    baseUrl?: string;
    model?: string;
    timeoutMs?: number;
  } = {}) {
    this.baseUrl = (
      options.baseUrl ?? DEFAULT_OLLAMA_URL
    ).replace(/\/+$/, "");

    this.model = options.model ?? DEFAULT_OLLAMA_MODEL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }


  async analyzeImage(
    image: Buffer,
    prompt: string,
    options: {
      model?: string;
      systemPrompt?: string;
    } = {},
  ): Promise<AiGenerationResponse> {
    if (image.length === 0) {
      throw new Error("Cannot analyze an empty image");
    }

    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: options.model ?? "gemma3:4b",
          system: options.systemPrompt ??
            "You are a visual evidence analyst. Describe only what the image supports. Do not invent unseen objects or actions.",
          prompt: "/no_think\n" + prompt,
          images: [image.toString("base64")],
          stream: false,
          think: false,
          format: "json",
          options: {
            temperature: 0,
            num_predict: 2048,
          },
        }),
        signal: AbortSignal.timeout(Math.max(this.timeoutMs, 120_000)),
      });
    } catch (error) {
      throw new Error(
        `Local Ollama vision request failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }

    if (!response.ok) {
      throw new Error(
        `Local Ollama vision returned HTTP ${response.status}`,
      );
    }

    const result = await response.json() as OllamaGenerateResponse;

    if (
      typeof result.response !== "string" ||
      typeof result.model !== "string" ||
      result.done !== true
    ) {
      throw new Error(
        "Local Ollama vision returned an invalid response " +
        "(model: " + String(result.model) +
        ", done: " + String(result.done) +
        ", reason: " + String(result.done_reason ?? "unknown") + ")",
      );
    }

    if (result.response.trim().length === 0) {
      throw new Error(
        "Local Ollama vision returned an empty response " +
        "(model: " + result.model +
        ", reason: " + String(result.done_reason ?? "unknown") +
        ", generated tokens: " +
        String((result as OllamaGenerateResponse & { eval_count?: number }).eval_count ?? "unknown") +
        ")",
      );
    }

    return {
      text: result.response,
      provider: this.name,
      model: result.model,
    };
  }

  async generate(
    request: AiGenerationRequest,
  ): Promise<AiGenerationResponse> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          system: request.systemPrompt,
          prompt: request.userPrompt,
          stream: false,
          think: false,
          ...(request.format === "json" ? { format: "json" } : {}),
          options: {
            ...(request.temperature !== undefined
              ? { temperature: request.temperature }
              : {}),
            ...(request.maxOutputTokens !== undefined
              ? { num_predict: request.maxOutputTokens }
              : {}),
          },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new Error(
        `Local Ollama request failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }

    if (!response.ok) {
      throw new Error(
        `Local Ollama returned HTTP ${response.status}`,
      );
    }

    let result: OllamaGenerateResponse;

    try {
      result = await response.json() as OllamaGenerateResponse;
    } catch {
      throw new Error("Local Ollama returned invalid JSON");
    }

    if (
      typeof result.response !== "string" ||
      typeof result.model !== "string" ||
      result.done !== true
    ) {
      throw new Error(
        "Local Ollama returned an invalid generation response",
      );
    }

    if (result.response.trim().length === 0) {
      throw new Error(
        `Local Ollama returned an empty generation response` +
        ` (model: ${result.model}, reason: ${result.done_reason ?? "unknown"})`,
      );
    }

    return {
      text: result.response,
      provider: this.name,
      model: result.model,
    };
  }
}