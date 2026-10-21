import type {
  AiGenerationRequest,
  AiGenerationResponse,
  AiProvider,
} from "./aiProvider.js";

const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_TIMEOUT_MS = 120_000;
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  modelVersion?: string;
  error?: {
    message?: string;
  };
}

export class GeminiProvider implements AiProvider {
  readonly name = "gemini" as const;

  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options: {
    apiKey?: string;
    model?: string;
    timeoutMs?: number;
  } = {}) {
    this.apiKey = options.apiKey ?? process.env.GEMINI_API_KEY ?? "";
    this.model = options.model ?? DEFAULT_MODEL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY is required for Gemini inference");
    }
  }

  private async request(
    parts: Array<Record<string, unknown>>,
    options: {
      model?: string;
      systemPrompt?: string;
      temperature?: number;
      maxOutputTokens?: number;
      format?: "text" | "json";
    } = {},
  ): Promise<AiGenerationResponse> {
    const model = options.model ?? this.model;

    const payload = {
      contents: [{ role: "user", parts }],
      ...(options.systemPrompt
        ? {
            systemInstruction: {
              parts: [{ text: options.systemPrompt }],
            },
          }
        : {}),
      generationConfig: {
        ...(options.temperature !== undefined
          ? { temperature: options.temperature }
          : {}),
        maxOutputTokens: options.maxOutputTokens ?? 2048,
        ...(options.format === "json"
          ? { responseMimeType: "application/json" }
          : {}),
      },
    };

    const response = await fetch(
      `${API_BASE}/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini returned HTTP ${response.status}`);
    }

    const result = (await response.json()) as GeminiResponse;
    const candidate = result.candidates?.[0];

    if (candidate?.finishReason !== "STOP") {
      throw new Error(
        `Gemini generation did not complete: ${
          candidate?.finishReason ?? "unknown"
        }`,
      );
    }

    const text = candidate.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!text) {
      throw new Error("Gemini returned an empty response");
    }

    return {
      text,
      provider: this.name,
      model: result.modelVersion ?? model,
    };
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

    const mimeType =
      image.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
        ? "image/jpeg"
        : image.subarray(0, 8).equals(
            Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
          )
          ? "image/png"
          : null;

    if (!mimeType) {
      throw new Error("Unsupported Gemini image format");
    }

    return this.request(
      [
        { text: prompt },
        {
          inline_data: {
            mime_type: mimeType,
            data: image.toString("base64"),
          },
        },
      ],
      {
        ...(options.systemPrompt !== undefined
          ? { systemPrompt: options.systemPrompt }
          : {}),
        maxOutputTokens: 2048,
        format: "json",
      },
    );
  }

  async generate(
    request: AiGenerationRequest,
  ): Promise<AiGenerationResponse> {
    return this.request(
      [{ text: request.userPrompt }],
      {
        systemPrompt: request.systemPrompt,
        ...(request.temperature !== undefined
          ? { temperature: request.temperature }
          : {}),
        ...(request.maxOutputTokens !== undefined
          ? { maxOutputTokens: request.maxOutputTokens }
          : {}),
        ...(request.format !== undefined
          ? { format: request.format }
          : {}),
      },
    );
  }
}
