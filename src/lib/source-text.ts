export type TranscriptChoice = "replace" | "append" | "cancel";

export type TranscriptHandoff =
  | { kind: "apply"; sourceText: string }
  | { kind: "choose"; sourceText: string; transcript: string }
  | { kind: "preserve"; sourceText: string };

export type TranscriptionOutcome = TranscriptHandoff | {
  kind: "error";
  sourceText: string;
  error: unknown;
};

export function isSourceTextAnalyzable(sourceText: string): boolean {
  return sourceText.trim().length > 0;
}

export function resolveTranscriptHandoff(
  existingText: string,
  transcriptResult: string,
  choice?: TranscriptChoice,
): TranscriptHandoff {
  const transcript = transcriptResult.trim();
  if (!transcript) {
    return { kind: "preserve", sourceText: existingText };
  }

  if (!isSourceTextAnalyzable(existingText)) {
    return { kind: "apply", sourceText: transcript };
  }

  if (choice === "replace") {
    return { kind: "apply", sourceText: transcript };
  }

  if (choice === "append") {
    const separator = existingText.endsWith("\n") ? "\n" : "\n\n";
    return { kind: "apply", sourceText: `${existingText}${separator}${transcript}` };
  }

  if (choice === "cancel") {
    return { kind: "preserve", sourceText: existingText };
  }

  return { kind: "choose", sourceText: existingText, transcript };
}

export async function transcribeAndPrepareHandoff(
  existingText: string | (() => string),
  transcribe: () => Promise<string>,
): Promise<TranscriptionOutcome> {
  const readExistingText =
    typeof existingText === "function" ? existingText : () => existingText;
  try {
    const transcript = await transcribe();
    return resolveTranscriptHandoff(readExistingText(), transcript);
  } catch (error) {
    return { kind: "error", sourceText: readExistingText(), error };
  }
}
