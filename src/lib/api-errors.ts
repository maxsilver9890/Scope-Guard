import { ModelProviderError } from "./deepseek";

export type ApiFailure = {
  status: number;
  error: string;
};

const DEFAULT_FALLBACK =
  "The analysis could not be completed. Please try again.";

/**
 * Map a failure to an application status and a client-safe message.
 *
 * Provider failures are reported with meaningful statuses so the client can
 * distinguish "try later" from "your request was wrong". Unrelated
 * application errors keep a generic 500 and are never presented as provider
 * outages. No provider payload, key, or internal detail reaches the client.
 */
export function toApiFailure(
  error: unknown,
  fallback: string = DEFAULT_FALLBACK,
): ApiFailure {
  if (error instanceof ModelProviderError) {
    switch (error.kind) {
      case "rate-limit":
        return {
          status: 429,
          error:
            "The model provider is rate-limited right now. Please try again in a few minutes.",
        };
      case "timeout":
        return {
          status: 504,
          error:
            "The analysis timed out before the model finished. Please try again.",
        };
      case "unavailable":
        return {
          status: 503,
          error:
            "The analysis service is temporarily unavailable. Please try again shortly.",
        };
      case "auth":
        return {
          status: 503,
          error:
            "The analysis service is temporarily unavailable. Please try again shortly.",
        };
      case "request":
        return {
          status: 502,
          error:
            "The analysis service could not process this request with the configured model. Please try again shortly.",
        };
      case "invalid-response":
        return {
          status: 502,
          error:
            "The model returned an unusable response. Please try again.",
        };
    }
  }

  return { status: 500, error: fallback };
}
