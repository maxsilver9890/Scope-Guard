import assert from "node:assert/strict";
import { test } from "node:test";

import { POST as resolvePost } from "../src/app/api/resolve/route.ts";
import type { Scope } from "../src/lib/schema.ts";

const SCOPE: Scope = {
  problemStatement: "The team needs one place to see work.",
  inScope: [],
  outOfScope: [],
  assumptions: [],
  openQuestions: [{ text: "What is the report delivery time?", status: "unresolved" }],
  requirements: [],
  acceptanceCriteria: [],
  clarifications: [],
};

function body(overrides: Record<string, unknown> = {}): Request {
  return new Request("http://localhost/api/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: "Dana: We need a dashboard.",
      scope: SCOPE,
      findings: [],
      question: "What is the report delivery time?",
      answer: "Every Monday at 8 AM.",
      confirmed: true,
      ...overrides,
    }),
  });
}

test("resolve route rejects malformed JSON", async () => {
  const response = await resolvePost(
    new Request("http://localhost/api/resolve", {
      method: "POST",
      body: "{not json",
    }),
  );

  assert.equal(response.status, 400);
  const payload = (await response.json()) as { error: string };
  assert.match(payload.error, /valid JSON/i);
});

test("resolve route rejects a missing answer", async () => {
  const response = await resolvePost(body({ answer: "" }));

  assert.equal(response.status, 400);
  const payload = (await response.json()) as { error: string };
  assert.match(payload.error, /answer/i);
});

test("resolve route rejects a missing transcript", async () => {
  const response = await resolvePost(body({ input: "   " }));

  assert.equal(response.status, 400);
  const payload = (await response.json()) as { error: string };
  assert.match(payload.error, /transcript|input/i);
});

test("resolve route rejects a question that is not open", async () => {
  const response = await resolvePost(
    body({ question: "What is the project budget?" }),
  );

  assert.equal(response.status, 400);
  const payload = (await response.json()) as { error: string };
  assert.match(payload.error, /not open in the current scope/i);
});
