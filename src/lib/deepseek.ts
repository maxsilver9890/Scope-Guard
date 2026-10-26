/**
 * Model client for Scope Guard.
 *
 * Talks to any OpenAI-compatible chat-completions endpoint. The current setup
 * targets OpenRouter, and the model is fixed through DEEPSEEK_MODEL.
 *
 * Environment:
 *   DEEPSEEK_API_KEY    - provider API key
 *   DEEPSEEK_BASE_URL   - optional, defaults to https://api.deepseek.com/v1
 *   DEEPSEEK_MODEL      - required; fixed provider model id
 *   DEEPSEEK_TIMEOUT_MS - optional total request timeout, default 75000
 */

export type ModelFailureKind =
  | "rate-limit"
  | "timeout"
  | "unavailable"
  | "auth"
  | "request"
  | "invalid-response";

export class ModelProviderError extends Error {
  readonly kind: ModelFailureKind;
  readonly providerStatus?: number;

  constructor(
    kind: ModelFailureKind,
    message: string,
    providerStatus?: number,
  ) {
    super(message);
    this.name = "ModelProviderError";
    this.kind = kind;
    this.providerStatus = providerStatus;
  }
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatCompletionUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
};

export type ChatCompletionResult = {
  model: string;
  /** Assistant message content. */
  content: string;
  /** Raw response body, exactly as returned by the provider. */
  raw: string;
  usage?: ChatCompletionUsage;
  finishReason?: string;
};

export type ChatCompletionOptions = {
  temperature?: number;
  maxTokens?: number;
  /** Request a JSON object response where the provider supports it. */
  jsonMode?: boolean;
  /** Request strict structured output using a JSON schema. */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  /**
   * Provider reasoning control. Against OpenRouter this defaults to
   * `{ enabled: false }` so reasoning cannot consume the whole output budget.
   * Pass `null` to omit the parameter entirely.
   */
  reasoning?: Record<string, unknown> | null;
};

type ProviderResponse = {
  model?: string;
  error?: {
    message?: string;
    code?: string | number;
  };
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string | null;
      reasoning?: string | null;
    };
  }>;
  usage?: ChatCompletionUsage;
};

export const DEEPSEEK_DEFAULT_BASE_URL = "https://api.deepseek.com/v1";

const DEFAULT_TIMEOUT_MS = 75_000;
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);
const RETRYABLE_CODES = new Set([
  "rate_limit_exceeded",
  "service_busy",
  "overloaded",
  "provider_overloaded",
]);

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing ${name}. Add it to .env.local (see .env.example) and restart the server.`,
    );
  }
  return value;
}

function readTimeoutMs(): number {
  const configured = Number(process.env.DEEPSEEK_TIMEOUT_MS);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.min(Math.max(configured, 5_000), 180_000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncate(text: string, max = 240): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max)}…`;
}

function usageSummary(usage?: ChatCompletionUsage): string {
  if (!usage) {
    return "tokens=?";
  }
  const reasoning = usage.completion_tokens_details?.reasoning_tokens;
  const base = `tokens=${usage.prompt_tokens ?? "?"}/${usage.completion_tokens ?? "?"}`;
  return reasoning ? `${base} (reasoning=${reasoning})` : base;
}

function describeProviderError(
  parsed: ProviderResponse | null,
  raw: string,
): string {
  const message = parsed?.error?.message;
  const code = parsed?.error?.code;

  if (typeof message === "string" && message.trim()) {
    const summary = truncate(message, 200);
    return code ? `${summary} (code: ${String(code)})` : summary;
  }

  return truncate(raw, 200) || "no error details";
}

function isRetryableError(parsed: ProviderResponse | null): boolean {
  const code = parsed?.error?.code;
  return typeof code === "string" && RETRYABLE_CODES.has(code);
}

function classifyHttpStatus(status: number): ModelFailureKind {
  if (status === 429) {
    return "rate-limit";
  }
  if (status === 401 || status === 403) {
    return "auth";
  }
  if (status === 408 || status === 504) {
    return "timeout";
  }
  if (status === 402 || status >= 500) {
    return "unavailable";
  }
  return "request";
}

function classifySoftError(parsed: ProviderResponse | null): ModelFailureKind {
  const code = parsed?.error?.code;
  const normalized = String(code ?? "").toLowerCase();

  if (normalized === "401" || normalized === "403") {
    return "auth";
  }
  if (normalized.includes("rate") || normalized === "429") {
    return "rate-limit";
  }
  return "unavailable";
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
): Promise<ChatCompletionResult> {
  const apiKey = requireEnv("DEEPSEEK_API_KEY");
  const baseUrl = (
    process.env.DEEPSEEK_BASE_URL?.trim() || DEEPSEEK_DEFAULT_BASE_URL
  ).replace(/\/+$/, "");
  const model = requireEnv("DEEPSEEK_MODEL");
  const timeoutMs = readTimeoutMs();
  const maxTokens = options.maxTokens ?? 256;

  // OpenRouter reasoning models can spend the entire completion budget on
  // hidden reasoning and then return null content. Disable it by default.
  const isOpenRouter = /openrouter\.ai/i.test(baseUrl);
  const reasoning =
    options.reasoning === undefined
      ? isOpenRouter
        ? { enabled: false }
        : undefined
      : options.reasoning;

  const deadline = Date.now() + timeoutMs;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new ModelProviderError(
        "timeout",
        `Model request exceeded ${timeoutMs}ms (model: ${model}).`,
      );
    }

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: maxTokens,
      stream: false,
    };

    if (reasoning) {
      body.reasoning = reasoning;
    }
    if (options.jsonSchema) {
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: options.jsonSchema.name,
          strict: true,
          schema: options.jsonSchema.schema,
        },
      };
    } else if (options.jsonMode) {
      body.response_format = { type: "json_object" };
    }

    const startedAt = Date.now();
    let response: Response;
    let raw: string;

    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(Math.min(remaining, 60_000)),
      });
      raw = await response.text();
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError");

      console.error(
        `[llm] model=${model} request failed after ${Date.now() - startedAt}ms: ${
          timedOut ? "timeout" : truncate(String(error), 160)
        }`,
      );

      if (timedOut) {
        throw new ModelProviderError(
          "timeout",
          `Model request timed out (model: ${model}, timeout: ${timeoutMs}ms). Try again or use a faster model.`,
        );
      }
      if (attempt < MAX_ATTEMPTS) {
        await sleep(1000 * attempt);
        continue;
      }
      throw new ModelProviderError(
        "unavailable",
        `Could not reach the model provider after ${MAX_ATTEMPTS} attempts (model: ${model}).`,
      );
    }

    let parsed: ProviderResponse | null = null;
    try {
      parsed = JSON.parse(raw) as ProviderResponse;
    } catch {
      parsed = null;
    }

    const choice = parsed?.choices?.[0];
    const content = choice?.message?.content;
    const reasoningText = choice?.message?.reasoning;
    const finishReason = choice?.finish_reason;
    const returnedModel = parsed?.model ?? model;
    const usage = parsed?.usage;

    console.info(
      `[llm] model=${model} returned=${returnedModel} finish=${
        finishReason ?? "?"
      } ${usageSummary(usage)} ${Date.now() - startedAt}ms`,
    );

    if (!response.ok) {
      const detail = describeProviderError(parsed, raw);
      const retryable =
        RETRYABLE_STATUS.has(response.status) || isRetryableError(parsed);

      if (retryable && attempt < MAX_ATTEMPTS) {
        await sleep(1000 * attempt * attempt);
        continue;
      }

      throw new ModelProviderError(
        classifyHttpStatus(response.status),
        `Model provider returned HTTP ${response.status} (model: ${returnedModel}): ${detail}`,
        response.status,
      );
    }

    if (parsed?.error) {
      const detail = describeProviderError(parsed, raw);
      if (isRetryableError(parsed) && attempt < MAX_ATTEMPTS) {
        await sleep(1000 * attempt * attempt);
        continue;
      }
      throw new ModelProviderError(
        classifySoftError(parsed),
        `Model provider error (model: ${returnedModel}): ${detail}`,
      );
    }

    // A token-limited response will never become valid by retrying.
    if (finishReason === "length") {
      throw new ModelProviderError(
        "invalid-response",
        `Model hit the output token limit before finishing (finish_reason=length, model=${returnedModel}, max_tokens=${maxTokens}, ${usageSummary(
          usage,
        )}). Raise the token budget or use a model that does not spend output tokens on reasoning.`,
      );
    }

    if (typeof content !== "string" || content.trim() === "") {
      const spentOnReasoning =
        typeof reasoningText === "string" && reasoningText.trim() !== "";

      throw new ModelProviderError(
        "invalid-response",
        spentOnReasoning
          ? `Model returned reasoning but no final answer (finish_reason=${
              finishReason ?? "?"
            }, model=${returnedModel}, ${usageSummary(
              usage,
            )}). Reasoning consumed the output budget; disable reasoning or use a non-reasoning model.`
          : `Model returned no message content (finish_reason=${
              finishReason ?? "?"
            }, model=${returnedModel}, ${usageSummary(usage)}).`,
      );
    }

    return {
      model: returnedModel,
      content,
      raw,
      usage,
      finishReason,
    };
  }

  throw new ModelProviderError(
    "unavailable",
    "Model request exhausted retries without a response.",
  );
}

export async function helloWorld(): Promise<ChatCompletionResult> {
  return chatCompletion([{ role: "user", content: "hello world" }], {
    temperature: 0,
    maxTokens: 64,
  });
}