const DEFAULT_TRANSCRIPTION_MODEL = "openai/gpt-transcribe";
const DEFAULT_OPENROUTER_URL = "https://openrouter.ai/api/v1";
const TRANSCRIPTION_TIMEOUT_MS = 55_000;

export class TranscriptionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TranscriptionError";
  }
}

function providerConfig() {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new TranscriptionError(
      "Transcription is not configured. Add the OpenRouter API key on the server.",
      503,
    );
  }

  const baseUrl = (
    process.env.DEEPSEEK_BASE_URL?.trim() || DEFAULT_OPENROUTER_URL
  ).replace(/\/+$/, "");

  let hostname = "";
  try {
    hostname = new URL(baseUrl).hostname;
  } catch {
    throw new TranscriptionError(
      "Transcription is not configured with a valid OpenRouter URL.",
      503,
    );
  }
  if (hostname !== "openrouter.ai" && !hostname.endsWith(".openrouter.ai")) {
    throw new TranscriptionError(
      "Audio transcription requires the configured OpenRouter endpoint.",
      503,
    );
  }

  return {
    apiKey,
    url: `${baseUrl}/audio/transcriptions`,
    model:
      process.env.OPENROUTER_TRANSCRIPTION_MODEL?.trim() ||
      DEFAULT_TRANSCRIPTION_MODEL,
  };
}

export async function transcribeAudio(
  file: File,
  options: { signal?: AbortSignal; timeoutMs?: number; fetcher?: typeof fetch } = {},
): Promise<string> {
  const config = providerConfig();
  const fileBytes = await file.arrayBuffer();
  const providerFile = new File([fileBytes], file.name, {
    type: file.type || "application/octet-stream",
  });
  const form = new FormData();
  form.append("file", providerFile, file.name);
  form.append("model", config.model);

  const timeout = AbortSignal.timeout(
    options.timeoutMs ?? TRANSCRIPTION_TIMEOUT_MS,
  );
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout;

  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(config.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: form,
      signal,
      cache: "no-store",
    });
  } catch {
    if (options.signal?.aborted) {
      throw new TranscriptionError("Transcription was cancelled.", 499);
    }
    if (timeout.aborted) {
      throw new TranscriptionError(
        "Transcription took too long. Try a shorter recording.",
        504,
      );
    }
    throw new TranscriptionError(
      "Could not reach the transcription service. Check your connection and retry.",
      503,
    );
  }

  if (!response.ok) {
    if (response.status === 408 || response.status === 504) {
      throw new TranscriptionError(
        "Transcription took too long. Try a shorter recording.",
        504,
      );
    }
    if (response.status === 429) {
      throw new TranscriptionError(
        "The transcription service is busy. Wait a moment and retry.",
        429,
      );
    }
    if (response.status === 413) {
      throw new TranscriptionError(
        "This recording is too large for transcription.",
        413,
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new TranscriptionError(
        "The transcription service rejected its credentials. Check the server-side OpenRouter settings.",
        503,
      );
    }
    if (response.status === 404) {
      throw new TranscriptionError(
        "The configured transcription model is unavailable. Check the server-side model setting.",
        503,
      );
    }
    if (response.status === 400) {
      throw new TranscriptionError(
        "The transcription service could not read this audio file. Try another supported format.",
        422,
      );
    }
    throw new TranscriptionError(
      "The transcription service could not process this recording. Check the audio format and retry.",
      502,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new TranscriptionError(
      "The transcription service returned an unreadable response. Retry the recording.",
      502,
    );
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("text" in payload) ||
    typeof payload.text !== "string" ||
    payload.text.trim().length === 0
  ) {
    throw new TranscriptionError(
      "No speech was recognized. Try a clearer recording or paste a transcript instead.",
      422,
    );
  }

  return payload.text.trim();
}
