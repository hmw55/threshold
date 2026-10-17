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