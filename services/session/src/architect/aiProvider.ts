export type AiProviderName = "ollama" | "bedrock";

export interface AiGenerationRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  format?: "text" | "json";
}

export interface AiGenerationResponse {
  text: string;
  provider: AiProviderName;
  model: string;
}

export interface AiProvider {
  readonly name: AiProviderName;

  generate(
    request: AiGenerationRequest,
  ): Promise<AiGenerationResponse>;
}