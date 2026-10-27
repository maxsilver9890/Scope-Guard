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
      assert.equal("reasoning_effort" in requestedBody, false);
    },
  );
});

test("direct Gemini 3 requests send documented low reasoning effort", async () => {
  await withEnv(
    {
      DEEPSEEK_MODEL: "gemini-3.8-flash",
      SCOPE_GUARD_MODEL: null,
      DEEPSEEK_BASE_URL:
        "https://generativelanguage.googleapis.com/v1beta/openai",
    },
    async () => {
      let requestedBody: Record<string, unknown> = {};
      const messages = [
        { role: "system" as const, content: "Return a scope as JSON." },
        { role: "user" as const, content: "A client brief." },
      ];
      const fetcher: typeof fetch = async (_input, init) => {
        requestedBody = JSON.parse(String(init?.body)) as Record<
          string,
          unknown
        >;
        return successResponse();
      };

      await chatCompletion(messages, {
        fetchImpl: fetcher,
        maxAttempts: 1,
        temperature: 0.2,
        maxTokens: 5000,
        jsonMode: true,
      });

      assert.equal(requestedBody.model, "gemini-3.8-flash");
      assert.equal(requestedBody.temperature, 0.2);
      assert.equal(requestedBody.max_tokens, 5000);
      assert.equal(requestedBody.stream, false);
      assert.deepEqual(requestedBody.response_format, { type: "json_object" });
      assert.equal(requestedBody.reasoning_effort, "low");
      assert.equal("reasoning" in requestedBody, false);
    },
  );
});

test("retryable provider errors log status and redact prompt content and keys", async () => {
  await withEnv(
    {
      DEEPSEEK_MODEL: "gemini-3.8-flash",
      SCOPE_GUARD_MODEL: null,
      DEEPSEEK_BASE_URL:
        "https://generativelanguage.googleapis.com/v1beta/openai",
    },
    async () => {
      const logs: string[] = [];
      const originalInfo = console.info;
      const originalWarn = console.warn;
      const originalError = console.error;
      const sensitiveText = "Confidential client transcript text";
      const apiKey = "test-key-not-a-real-credential";

      console.info = (...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
      };
      console.warn = (...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
      };
      console.error = (...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
      };

      try {
        let calls = 0;
        const fetcher: typeof fetch = async (_input, init) => {
          calls += 1;
          const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
          assert.equal(body.reasoning_effort, "low");

          if (calls === 1) {
            return new Response(`upstream error: ${sensitiveText}`, {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            });
          }

          return successResponse("ok");
        };

        const result = await chatCompletion(
          [{ role: "user", content: sensitiveText }],
          {
            fetchImpl: fetcher,
            timeoutMs: 5_000,
            maxAttempts: 2,
            sleepImpl: async () => undefined,
          },
        );

        assert.equal(result.content, "ok");
        assert.equal(calls, 2);
        const output = logs.join("\n");
        assert.match(output, /status=503/);
        assert.match(output, /retryable=true/);
        assert.match(output, /reasoning_effort=low/);
        assert.equal(output.includes(apiKey), false);
        assert.equal(output.includes(sensitiveText), false);
      } finally {
        console.info = originalInfo;
        console.warn = originalWarn;
        console.error = originalError;
      }
    },
  );
});

test("provider errors expose sanitized messages without prompt or key echoes", async () => {
  await withEnv(
    {
      DEEPSEEK_MODEL: "gemini-3.8-flash",
      SCOPE_GUARD_MODEL: null,
      DEEPSEEK_BASE_URL:
        "https://generativelanguage.googleapis.com/v1beta/openai",
    },
    async () => {
      const logs: string[] = [];
      const originalWarn = console.warn;
      const prompt = "Private project transcript";
      const key = "test-key-not-a-real-credential";
      console.warn = (...args: unknown[]) => logs.push(args.map(String).join(" "));

      try {
        const fetcher: typeof fetch = async () =>
          new Response(
            JSON.stringify({
              error: {
                code: 400,
                message: `Invalid request for ${prompt}; credential ${key}`,
                status: "INVALID_ARGUMENT",
              },
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );

        await assert.rejects(
          chatCompletion([{ role: "user", content: prompt }], {
            fetchImpl: fetcher,
            maxAttempts: 1,
          }),
          (error: unknown) =>
            error instanceof ModelProviderError &&
            error.message.includes("Invalid request") &&
            error.message.includes("[redacted]") &&
            !error.message.includes(prompt) &&
            !error.message.includes(key),
        );

        const output = logs.join("\n");
        assert.match(output, /Invalid request/);
        assert.match(output, /code=400/);
        assert.equal(output.includes(prompt), false);
        assert.equal(output.includes(key), false);
      } finally {
        console.warn = originalWarn;
      }
    },
  );
});

test("Google nested 503 errors log the provider message and code safely", async () => {
  await withEnv(
    {
      DEEPSEEK_MODEL: "gemini-3.8-flash",
      SCOPE_GUARD_MODEL: null,
      DEEPSEEK_BASE_URL:
        "https://generativelanguage.googleapis.com/v1beta/openai",
    },
    async () => {
      const logs: string[] = [];
      const originalWarn = console.warn;
      const prompt = "Private bakery transcript";
      console.warn = (...args: unknown[]) => logs.push(args.map(String).join(" "));
      try {
        const fetcher: typeof fetch = async () =>
          new Response(
            JSON.stringify({
              error: {
                code: 503,
                status: "UNAVAILABLE",
                errors: [
                  {
                    reason: "backendError",
                    message: `Temporary model overload while handling ${prompt}`,
                  },
                ],
              },
            }),
            { status: 503 },
          );

        await assert.rejects(
          chatCompletion([{ role: "user", content: prompt }], {
            fetchImpl: fetcher,
            maxAttempts: 1,
          }),
          (error: unknown) =>
            error instanceof ModelProviderError &&
            error.message.includes("Temporary model overload") &&
            error.message.includes("[redacted]") &&
            !error.message.includes(prompt),
        );
        const output = logs.join("\n");
        assert.match(output, /code=503/);
        assert.match(output, /Temporary model overload/);
        assert.equal(output.includes(prompt), false);
      } finally {
        console.warn = originalWarn;
      }
    },
  );
});

test("root-level provider message and code fields are parsed", async () => {
  await withEnv({ DEEPSEEK_MODEL: "busy/model" }, async () => {
    const logs: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => logs.push(args.map(String).join(" "));
    try {
      await assert.rejects(
        chatCompletion([{ role: "user", content: "hi" }], {
          fetchImpl: async () =>
            new Response(
              JSON.stringify({ message: "Gateway temporarily unavailable", code: 503 }),
              { status: 503 },
            ),
          maxAttempts: 1,
        }),
        (error: unknown) =>
          error instanceof ModelProviderError &&
          error.message.includes("Gateway temporarily unavailable"),
      );
      assert.match(logs.join("\n"), /code=503/);
      assert.match(logs.join("\n"), /Gateway temporarily unavailable/);
    } finally {
      console.warn = originalWarn;
    }
  });
});

test("a reasoning-only completion fails as an invalid response without retrying", async () => {
  await withEnv(
    {
      DEEPSEEK_MODEL: "gemini-3.8-flash",
      SCOPE_GUARD_MODEL: null,
      DEEPSEEK_BASE_URL:
        "https://generativelanguage.googleapis.com/v1beta/openai",
    },
    async () => {
      let calls = 0;
      const fetcher: typeof fetch = async () => {
        calls += 1;
        return new Response(
          JSON.stringify({
            model: "gemini-3.8-flash",
            choices: [
              {
                finish_reason: "stop",
                message: { content: null, reasoning: "internal reasoning" },
              },
            ],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 5000,
              total_tokens: 5100,
              completion_tokens_details: { reasoning_tokens: 5000 },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
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
          error instanceof ModelProviderError &&
          error.kind === "invalid-response" &&
          /reasoning/i.test(error.message),
      );
      assert.equal(calls, 1);
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

test("a length-limited completion reports the output-token cause without retrying", async () => {
  await withEnv(
    {
      DEEPSEEK_MODEL: "gemini-3.8-flash",
      SCOPE_GUARD_MODEL: null,
      DEEPSEEK_BASE_URL:
        "https://generativelanguage.googleapis.com/v1beta/openai",
    },
    async () => {
      let calls = 0;
      const fetcher: typeof fetch = async () => {
        calls += 1;
        return new Response(
          JSON.stringify({
            model: "gemini-3.8-flash",
            choices: [
              {
                finish_reason: "length",
                message: { content: '{"problemStatement":"truncated"' },
              },
            ],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 5000,
              total_tokens: 5100,
              completion_tokens_details: { reasoning_tokens: 4200 },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      };

      await assert.rejects(
        chatCompletion([{ role: "user", content: "hi" }], {
          fetchImpl: fetcher,
          timeoutMs: 5_000,
          maxAttempts: 2,
          maxTokens: 5000,
          sleepImpl: async () => undefined,
        }),
        (error: unknown) =>
          error instanceof ModelProviderError &&
          error.kind === "invalid-response" &&
          /finish_reason=length/.test(error.message) &&
          /max_tokens=5000/.test(error.message) &&
          /reasoning=4200/.test(error.message),
      );
      assert.equal(calls, 1);
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

test("Retry-After is honored when the deadline leaves time for another attempt", async () => {
  await withEnv(
    { DEEPSEEK_MODEL: "busy/model" },
    async () => {
      let calls = 0;
      const delays: number[] = [];
      const fetcher: typeof fetch = async () => {
        calls += 1;
        return calls === 1
          ? new Response(JSON.stringify({ error: { code: 503, message: "busy" } }), {
              status: 503,
              headers: { "Retry-After": "2" },
            })
          : successResponse();
      };

      const result = await chatCompletion([{ role: "user", content: "hi" }], {
        fetchImpl: fetcher,
        deadline: Date.now() + 10_000,
        maxAttempts: 2,
        sleepImpl: async (ms) => { delays.push(ms); },
      });
      assert.equal(result.content, "ok");
      assert.equal(calls, 2);
      assert.deepEqual(delays, [2_000]);
    },
  );
});

test("Retry-After that leaves no retry budget prevents the retry", async () => {
  await withEnv(
    { DEEPSEEK_MODEL: "busy/model" },
    async () => {
      let calls = 0;
      const fetcher: typeof fetch = async () => {
        calls += 1;
        return new Response(JSON.stringify({ error: { code: 503, message: "busy" } }), {
          status: 503,
          headers: { "Retry-After": "2" },
        });
      };

      await assert.rejects(
        chatCompletion([{ role: "user", content: "hi" }], {
          fetchImpl: fetcher,
          deadline: Date.now() + 2_500,
          maxAttempts: 3,
          sleepImpl: async () => undefined,
        }),
        (error: unknown) => error instanceof ModelProviderError && error.kind === "timeout",
      );
      assert.equal(calls, 1);
    },
  );
});

test("a non-retryable 4xx status is never retried for a transient-looking code", async () => {
  await withEnv(
    { DEEPSEEK_MODEL: "busy/model" },
    async () => {
      let calls = 0;
      const fetcher: typeof fetch = async () => {
        calls += 1;
        return new Response(
          JSON.stringify({ error: { code: "service_busy", message: "invalid request" } }),
          { status: 400 },
        );
      };

      await assert.rejects(
        chatCompletion([{ role: "user", content: "hi" }], {
          fetchImpl: fetcher,
          maxAttempts: 3,
          sleepImpl: async () => undefined,
        }),
        (error: unknown) => error instanceof ModelProviderError && error.kind === "request",
      );
      assert.equal(calls, 1);
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
