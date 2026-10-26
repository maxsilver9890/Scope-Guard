import { readFile } from "node:fs/promises";
import path from "node:path";

import { critiqueScope } from "../lib/critique";
import { generateScope } from "../lib/generate";

async function main() {
  const samplePath = path.resolve(
    process.cwd(),
    "samples/discovery-call-transcript.txt",
  );
  const rawInput = await readFile(samplePath, "utf8");

  console.log("=== SAMPLE INPUT ===");
  console.log(rawInput.trim());
  console.log("\n=== GENERATING SCOPE ===");

  const scope = await generateScope(rawInput);
  console.log(JSON.stringify(scope, null, 2));

  console.log("\n=== RUNNING CRITIQUE ===");
  const findings = await critiqueScope(rawInput, scope);
  console.log(JSON.stringify(findings, null, 2));
}

main().catch((error) => {
  console.error(
    "\nPipeline failed:",
    error instanceof Error ? error.stack ?? error.message : error,
  );
  process.exitCode = 1;
});