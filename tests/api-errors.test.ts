import assert from "node:assert/strict";
import { test } from "node:test";

import { toApiFailure } from "../src/lib/api-errors.ts";
import { ModelProviderError } from "../src/lib/deepseek.ts";

test("rate limits map to 429 with a retryable message", () => {
  const failure = toApiFailure(
    new ModelProviderError("rate-limit", "provider detail: quota"),
  );

  assert.equal(failure.status, 429);
  assert.match(failure.error, /rate-limited/i);
  assert.equal(failure.error.includes("provider detail"), false);
});

test("provider timeouts map to 504", () => {
  const failure = toApiFailure(
    new ModelProviderError("timeout", "timed out after 75s"),
  );

  assert.equal(failure.status, 504);
  assert.match(failure.error, /timed out/i);
  assert.match(failure.error, /SCOPE_GUARD_MODEL/);
});

test("temporary provider failures map to 503", () => {
  const failure = toApiFailure(
    new ModelProviderError("unavailable", "upstream 503"),
  );

  assert.equal(failure.status, 503);
  assert.match(failure.error, /temporarily unavailable/i);
});

test("provider authentication failures are not exposed as client auth errors", () => {
  const failure = toApiFailure(
    new ModelProviderError("auth", "HTTP 401: invalid key sk-secret"),
  );

  assert.equal(failure.status, 503);
  assert.match(failure.error, /temporarily unavailable/i);
  assert.equal(
    /credential|api key|sk-secret/i.test(failure.error),
    false,
  );
});

test("provider request errors map to 502", () => {
  const failure = toApiFailure(
    new ModelProviderError("request", "HTTP 404 model missing"),
  );

  assert.equal(failure.status, 502);
  assert.match(failure.error, /could not process/i);
});

test("unusable model output maps to 502", () => {
  const failure = toApiFailure(
    new ModelProviderError("invalid-response", "no message content"),
  );

  assert.equal(failure.status, 502);
  assert.match(failure.error, /unusable response/i);
});

test("unrelated application errors stay 500 and keep the fallback", () => {
  const failure = toApiFailure(
    new Error("generateScope: model output did not match the scope schema"),
  );

  assert.equal(failure.status, 500);
  assert.match(failure.error, /could not be completed/i);
});

test("error text alone cannot misclassify an application error as a provider rate limit", () => {
  const failure = toApiFailure(
    new Error("Rate limit note in a validation message: HTTP 429"),
  );

  assert.equal(failure.status, 500);
});

test("resolve uses its own user-safe fallback for unknown errors", () => {
  const failure = toApiFailure(
    new Error("unexpected internal failure"),
    "The clarification could not be applied. Your current scope was not changed.",
  );

  assert.equal(failure.status, 500);
  assert.match(failure.error, /current scope was not changed/i);
});