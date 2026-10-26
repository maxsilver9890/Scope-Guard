import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isSourceTextAnalyzable,
  resolveTranscriptHandoff,
  transcribeAndPrepareHandoff,
} from "../src/lib/source-text.ts";

test("text-only input is analyzable without selecting or using audio", () => {
  assert.equal(isSourceTextAnalyzable("Client needs a course catalog."), true);
});

test("recording transcription populates an empty source field", () => {
  assert.deepEqual(
    resolveTranscriptHandoff("", "  Recorded discussion.  "),
    { kind: "apply", sourceText: "Recorded discussion." },
  );
});

test("upload transcription populates an empty source field through the same handoff", () => {
  assert.deepEqual(
    resolveTranscriptHandoff("\n  ", "Uploaded discussion."),
    { kind: "apply", sourceText: "Uploaded discussion." },
  );
});

test("existing source text is preserved until the user chooses what to do", () => {
  assert.deepEqual(
    resolveTranscriptHandoff("Written project brief.", "Discovery transcript."),
    {
      kind: "choose",
      sourceText: "Written project brief.",
      transcript: "Discovery transcript.",
    },
  );
});

test("text entered while transcription is running is still protected", async () => {
  let existingText = "";
  let completeTranscription: ((value: string) => void) | undefined;
  const handoffPromise = transcribeAndPrepareHandoff(
    () => existingText,
    () => new Promise<string>((resolve) => {
      completeTranscription = resolve;
    }),
  );

  existingText = "Notes typed during transcription.";
  completeTranscription?.("Audio transcript.");

  assert.deepEqual(await handoffPromise, {
    kind: "choose",
    sourceText: "Notes typed during transcription.",
    transcript: "Audio transcript.",
  });
});

test("replace uses only the transcript", () => {
  assert.deepEqual(
    resolveTranscriptHandoff("Existing written context.", "  Transcript text.  ", "replace"),
    { kind: "apply", sourceText: "Transcript text." },
  );
});

test("append keeps the existing text and adds the transcript with a blank-line separator", () => {
  assert.deepEqual(
    resolveTranscriptHandoff("Existing written context.", "Transcript text.", "append"),
    {
      kind: "apply",
      sourceText: "Existing written context.\n\nTranscript text.",
    },
  );
});

test("cancel keeps existing source text unchanged", () => {
  assert.deepEqual(
    resolveTranscriptHandoff("Existing written context.\n", "Transcript text.", "cancel"),
    { kind: "preserve", sourceText: "Existing written context.\n" },
  );
});

test("transcription failure preserves existing source text", async () => {
  const outcome = await transcribeAndPrepareHandoff("Existing written context.", async () => {
    throw new Error("Provider unavailable");
  });

  assert.equal(outcome.kind, "error");
  assert.equal(outcome.sourceText, "Existing written context.");
  if (outcome.kind === "error") {
    assert.match(String(outcome.error), /Provider unavailable/);
  }
});

test("empty or whitespace-only source text cannot be analyzed", () => {
  assert.equal(isSourceTextAnalyzable(""), false);
  assert.equal(isSourceTextAnalyzable(" \n\t "), false);
});

test("transcription completion returns a text update, not an analysis action", () => {
  const handoff = resolveTranscriptHandoff("", "Transcript text.");

  assert.deepEqual(handoff, { kind: "apply", sourceText: "Transcript text." });
  assert.equal("analyze" in handoff, false);
});
