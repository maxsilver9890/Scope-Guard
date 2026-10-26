import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_AUDIO_BYTES,
  POST as transcribePost,
} from "../src/app/api/transcribe/route.ts";
import {
  TranscriptionError,
  transcribeAudio,
} from "../src/lib/transcription.ts";

const AUDIO = new Uint8Array([1, 2, 3, 4]);

function audioRequest(
  name = "conversation.webm",
  type = "audio/webm",
  bytes = AUDIO,
): Request {
  const form = new FormData();
  form.append("file", new File([bytes], name, { type }));
  return new Request("http://localhost/api/transcribe", {
    method: "POST",
    body: form,
  });
}

function withProviderEnv<T>(fn: () => Promise<T>): Promise<T> {
  const previous = {
    key: process.env.DEEPSEEK_API_KEY,
    base: process.env.DEEPSEEK_BASE_URL,
    model: process.env.OPENROUTER_TRANSCRIPTION_MODEL,
  };
  process.env.DEEPSEEK_API_KEY = "test-key-not-a-real-credential";
  process.env.DEEPSEEK_BASE_URL = "https://openrouter.ai/api/v1";
  process.env.OPENROUTER_TRANSCRIPTION_MODEL = "openai/gpt-transcribe";
  return fn().finally(() => {
    if (previous.key === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previous.key;
    if (previous.base === undefined) delete process.env.DEEPSEEK_BASE_URL;
    else process.env.DEEPSEEK_BASE_URL = previous.base;
    if (previous.model === undefined) delete process.env.OPENROUTER_TRANSCRIPTION_MODEL;
    else process.env.OPENROUTER_TRANSCRIPTION_MODEL = previous.model;
  });
}

async function withFetch<T>(fetcher: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const previous = globalThis.fetch;
  globalThis.fetch = fetcher;
  try {
    return await fn();
  } finally {
    globalThis.fetch = previous;
  }
}

test("transcription route rejects requests without multipart audio", async () => {
  const response = await transcribePost(
    new Request("http://localhost/api/transcribe", { method: "POST" }),
  );
  assert.equal(response.status, 415);
});

test("transcription route rejects a missing audio file", async () => {
  const response = await transcribePost(
    new Request("http://localhost/api/transcribe", {
      method: "POST",
      body: new FormData(),
    }),
  );
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /audio recording/i);
});

test("transcription route rejects unsupported file extensions", async () => {
  const response = await transcribePost(audioRequest("conversation.txt", "text/plain"));
  assert.equal(response.status, 415);
  assert.match((await response.json()).error, /unsupported audio format/i);
});

test("transcription route rejects MIME and extension mismatches", async () => {
  const response = await transcribePost(audioRequest("conversation.wav", "audio/webm"));
  assert.equal(response.status, 415);
});

test("transcription route enforces its bounded request-size limit", async () => {
  const request = new Request("http://localhost/api/transcribe", {
    method: "POST",
    headers: {
      "Content-Type": "multipart/form-data; boundary=fake",
      "Content-Length": String(MAX_AUDIO_BYTES + 70_000),
    },
    body: "--fake--",
  });
  const response = await transcribePost(request);
  assert.equal(response.status, 413);
});

test("transcription route rejects an audio file over 4 MiB", async () => {
  const response = await transcribePost(
    audioRequest("large.webm", "audio/webm", new Uint8Array(MAX_AUDIO_BYTES + 1)),
  );
  assert.equal(response.status, 413);
  assert.match((await response.json()).error, /4 MiB/i);
});

test("transcription route returns the provider transcript and forwards the selected model", async () => {
  await withProviderEnv(async () => withFetch(async (input, init) => {
    assert.equal(input, "https://openrouter.ai/api/v1/audio/transcriptions");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-key-not-a-real-credential");
    assert.ok(init?.body instanceof FormData);
    assert.equal((init.body as FormData).get("model"), "openai/gpt-transcribe");
    return Response.json({ text: "  We need a booking dashboard.  " });
  }, async () => {
    const response = await transcribePost(audioRequest());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { text: "We need a booking dashboard." });
  }));
});

test("transcription route maps provider failures to a safe message", async () => {
  await withProviderEnv(async () => withFetch(async () => new Response("private provider details", { status: 500 }), async () => {
    const response = await transcribePost(audioRequest());
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.match(body.error, /could not process/i);
    assert.doesNotMatch(body.error, /private provider details|test-key/i);
  }));
});

test("transcription route reports the transcription provider timeout", async () => {
  await withProviderEnv(async () => withFetch(async () => new Response("", { status: 504 }), async () => {
    const response = await transcribePost(audioRequest());
    assert.equal(response.status, 504);
    assert.match((await response.json()).error, /too long/i);
  }));
});

test("transcription adapter enforces its own request timeout", async () => {
  await withProviderEnv(async () => {
    const file = new File([AUDIO], "conversation.webm", { type: "audio/webm" });
    await assert.rejects(
      transcribeAudio(file, {
        timeoutMs: 5,
        fetcher: (_input, init) => new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
        }),
      }),
      (error: unknown) => error instanceof TranscriptionError && error.status === 504,
    );
  });
});

test("transcription route handles network failures without leaking provider details", async () => {
  await withProviderEnv(async () => withFetch(async () => { throw new Error("network internals and credentials"); }, async () => {
    const response = await transcribePost(audioRequest());
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.match(body.error, /could not reach/i);
    assert.doesNotMatch(body.error, /network internals|credentials/i);
  }));
});
