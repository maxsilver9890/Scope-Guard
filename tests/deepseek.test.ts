import assert from "node:assert/strict";
import { test } from "node:test";

import {
  chatCompletion,
  ModelProviderError,
} from "../src/lib/deepseek.ts";

const ENV_KEYS = [
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_BASE_URL",
  "DEEPSEEK_MODEL",
  "SCOPE_GUARD_MODEL",
  "DEEPSEEK_TIMEOUT_MS",
  "DEEPSEEK_MAX_ATTEMPTS",
] as const;

async function withEnv<T>(
  overrides: Partial<Record<(typeof ENV_KEYS)[number], string | null>>,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  ) as Record<(typeof ENV_KEYS)[number], string | undefined>;

  process.env.DEEPSEEK_API_KEY = "test-key-not-a-real-credential";
  process.env.DEEPSEEK_BASE_URL = "https://openrouter.ai/api/v1";

  for (const key of ENV_KEYS) {
    const value = overrides[key];
    if (value === null) {
      delete process.env[key];
    } else if (value !== undefined) {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const key of ENV_KEYS) {
      const value = previous[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function successResponse(content = "ok"): Response {
  return new Response(
    JSON.stringify({
      model: "test/model",
      choices: [{ message: { content }, finish_reason: "stop" }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

test("SCOPE_GUARD_MODEL overrides the existing analysis model", async () => {
  await withEnv(
    {
      DEEPSEEK_MODEL: "fallback/model",
      SCOPE_GUARD_MODEL: "fast/model",
    },
    async () => {
      let requestedModel = "";
      let requestedBody: Record<string, unknown> = {};
      const fetcher: typeof fetch = async (_input, init) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        requestedModel = String(body.model ?? "");
        requestedBody = body;
        return successResponse();
      };

      const result = await chatCompletion([{ role: "user", content: "hi" }], {
        fetchImpl: fetcher,
        maxAttempts: 1,
        jsonSchema: {
          name: "scope_guard_test",
          schema: { type: "object", properties: { ok: { type: "boolean" } } },
        },
      });

      assert.equal(requestedModel, "fast/model");
      assert.equal(result.content, "ok");
      assert.deepEqual(requestedBody.response_format, {
        type: "json_schema",
        json_schema: {
          name: "scope_guard_test",
          strict: true,
          schema: { type: "object", properties: { ok: { type: "boolean" } } },
        },
      });
      assert.deepEqual(requestedBody.reasoning, { enabled: false });
    },
  );
});

test("DEEPSEEK_MODEL remains the fallback when no override is set", async () => {
  await withEnv(
    {
      DEEPSEEK_MODEL: "fallback/model",
      SCOPE_GUARD_MODEL: null,
    },
    async () => {
      let requestedModel = "";
      const fetcher: typeof fetch = async (_input, init) => {
        const body = JSON.parse(String(init?.body)) as { model?: string };
        requestedModel = body.model ?? "";
        return successResponse();
      };

      await chatCompletion([{ role: "user", content: "hi" }], {
        fetchImpl: fetcher,
        maxAttempts: 1,
      });

      assert.equal(requestedModel, "fallback/model");
    },
  );
});

test("a model timeout fails once and does not spend retries", async () => {
  await withEnv(
    { DEEPSEEK_MODEL: "slow/model" },
    async () => {
      let calls = 0;
      const fetcher: typeof fetch = (_input, init) => {
        calls += 1;
        return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) {
            reject(new Error("missing abort signal"));
            return;
          }
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        });
      };

      await assert.rejects(
        chatCompletion([{ role: "user", content: "hi" }], {
          fetchImpl: fetcher,
          timeoutMs: 25,
          maxAttempts: 3,
          sleepImpl: async () => undefined,
        }),
        (error: unknown) =>
          error instanceof ModelProviderError && error.kind === "timeout",
      );
      assert.equal(calls, 1);
    },
  );
});

test("transient provider failures use the configured retry limit", async () => {
  await withEnv(
    { DEEPSEEK_MODEL: "busy/model" },
    async () => {
      let calls = 0;
      const fetcher: typeof fetch = async () => {
        calls += 1;
        return new Response(
          JSON.stringify({
            error: { message: "service busy", code: "service_busy" },
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        );
      };

      await assert.rejects(
        chatCompletion([{ role: "user", content: "hi" }], {
          fetchImpl: fetcher,
          timeoutMs: 5_000,
          maxAttempts: 2,
          sleepImpl: async () => undefined,
        }),
        (error: unknown) =>
          error instanceof ModelProviderError && error.kind === "unavailable",
      );
      assert.equal(calls, 2);
    },
  );
});

test("an exhausted analysis deadline prevents another provider call", async () => {
  await withEnv(
    { DEEPSEEK_MODEL: "slow/model" },
    async () => {
      let calls = 0;
      const fetcher: typeof fetch = async () => {
        calls += 1;
        return successResponse();
      };

      await assert.rejects(
        chatCompletion([{ role: "user", content: "hi" }], {
          fetchImpl: fetcher,
          deadline: Date.now() - 1,
          maxAttempts: 3,
        }),
        (error: unknown) =>
          error instanceof ModelProviderError &&
          error.kind === "timeout" &&
          /SCOPE_GUARD_MODEL/.test(error.message),
      );
      assert.equal(calls, 0);
    },
  );
});

test("the pipeline deadline aborts an in-flight provider request", async () => {
  await withEnv(
    { DEEPSEEK_MODEL: "slow/model" },
    async () => {
      let calls = 0;
      const fetcher: typeof fetch = (_input, init) => {
        calls += 1;
        return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) {
            reject(new Error("missing abort signal"));
            return;
          }
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        });
      };

      await assert.rejects(
        chatCompletion([{ role: "user", content: "hi" }], {
          fetchImpl: fetcher,
          deadline: Date.now() + 30,
          timeoutMs: 5_000,
          maxAttempts: 3,
          sleepImpl: async () => undefined,
        }),
        (error: unknown) =>
          error instanceof ModelProviderError && error.kind === "timeout",
      );
      assert.equal(calls, 1);
    },
  );
});

test("retry backoff cannot run past the remaining deadline", async () => {
  await withEnv(
    { DEEPSEEK_MODEL: "busy/model" },
    async () => {
      let calls = 0;
      let sleeps = 0;
      const fetcher: typeof fetch = async () => {
        calls += 1;
        return new Response(
          JSON.stringify({
            error: { message: "service busy", code: "service_busy" },
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        );
      };

      await assert.rejects(
        chatCompletion([{ role: "user", content: "hi" }], {
          fetchImpl: fetcher,
          deadline: Date.now() + 100,
          timeoutMs: 5_000,
          maxAttempts: 3,
          sleepImpl: async () => {
            sleeps += 1;
          },
        }),
        (error: unknown) =>
          error instanceof ModelProviderError && error.kind === "timeout",
      );
      assert.equal(calls, 1);
      assert.equal(sleeps, 0);
    },
  );
});
