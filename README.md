# Scope Guard

**Turn ambiguous client conversations into traceable, execution-ready scope — before the team starts building.**

Scope Guard is an AI-assisted scoping and requirements-verification workspace. It converts a messy discovery-call transcript or rough brief into a structured scope document, separates client-confirmed commitments from inferences and proposals, and then runs a separate critique pass to surface ambiguity, contradictions, missing information, and unsupported assumptions.

The core idea is simple: a generic summarizer makes an unresolved question look like a decision. Scope Guard keeps the question visible.

## What It Does

- Extracts a structured scope from raw text.
- Labels every scope item with a commitment status:
  - **Confirmed** — stated in the source.
  - **Inferred** — a reasonable interpretation with a stated rationale.
  - **Proposed** — a recommendation that still needs client approval.
  - **Unresolved** — an open decision or dependency.
- Verifies quoted evidence against the original transcript and recorded client clarifications.
- Renders the scope as a typeset project document rather than raw JSON.
- Runs a second Scope Guard review that returns consequential findings with type, description, downstream impact, and a verbatim source quote.
- Lets users edit the document without another model call.
- Exports the current document and findings as Markdown.
- Lets users resolve one open question with a client answer, regenerate the scope, re-run the critique, and inspect an actual before/after comparison.

## Implemented Features

### Two-pass analysis

1. **Generation** — `generateScope()` asks the model for a schema-shaped scope document.
2. **Critique** — `critiqueScope()` receives the source material and status-labelled scope, then returns findings classified as `ambiguity`, `contradiction`, `missing-info`, or `unsupported-assumption`.

The two calls are deliberately independent. The critique is not a summary of the generator; it reviews the generated document against the source.

### Commitment and provenance integrity

- Zod validates both raw model output and the repaired document.
- Every confirmed or inferred item is checked against a verbatim quote.
- Unsupported confirmed/inferred items are downgraded to proposals instead of being presented as client agreement.
- Tentative language ("let's say yes for now", "if it's easy", "I think") cannot become a confirmed commitment.
- Cherry-picked quotes are checked against caveats in the same client turn.
- Invented cadence, numeric thresholds, export formats, and security guarantees are caught and downgraded.
- Findings with unverifiable snippets are dropped; duplicate evidence is collapsed.
- A previously provisional requirement cannot become confirmed during clarification unless the quote is supported by a client-confirmed clarification.

### Editable document and export

- Inline editing for the problem statement and every scope item.
- Commitment statuses are read-only, so editing text cannot silently turn a proposal into an agreement.
- The results view marks the document as edited after analysis.
- Markdown export includes the current edited document, commitment statuses, client clarifications, and the current findings with source evidence.

### Question resolution

- Each open question has a **Resolve question** action.
- The user records the client's answer and marks whether the client actually confirmed it.
- Unconfirmed answers are stored as notes and cannot create confirmed commitments.
- Regeneration runs the real generation and critique passes again.
- A deterministic comparison shows changed, added, and removed scope items, plus findings that were resolved, retained, reworded, newly discovered, or could not be confidently matched.
- If the document has manual edits, the UI requires explicit acknowledgement before regeneration replaces them.

## Architecture

```text
Browser
  └─ ScopeWorkspace (client component)
       ├─ POST /api/analyze
       │    └─ generateScope
       │         ├─ rawScopeSchema validation
       │         ├─ repairScopeProvenance (deterministic)
       │         └─ scopeSchema validation
       │    └─ critiqueScope
       │         ├─ strict JSON-schema findings response
       │         ├─ salvage malformed findings
       │         ├─ enforceFindingProvenance
       │         └─ return { scope, findings }
       │
       └─ POST /api/resolve
            └─ resolveScope
                 ├─ validate request and selected question
                 ├─ generateScope with transcript + clarification + current document
                 ├─ repairScopeProvenance against both sources
                 ├─ block unsupported promotions to confirmed
                 ├─ critiqueScope against both sources
                 ├─ enforceFindingProvenance
                 └─ compareScopes → { scope, findings, comparison }
```

The original transcript is never rewritten. Clarifications are stored separately on the scope as `{ id, question, answer, confirmed }`. Scope items and findings record `sourceKind` (`transcript` or `clarification`) and, when applicable, `clarificationId`.

### Key files

| Path | Responsibility |
|---|---|
| `src/app/page.tsx` | Server entry point; reads the sample transcript, renders the header and workspace |
| `src/components/scope-workspace.tsx` | Intake, results, status display, editing, question resolution, comparison, export |
| `src/app/api/analyze/route.ts` | `POST /api/analyze` → `{ scope, findings }` |
| `src/app/api/resolve/route.ts` | `POST /api/resolve` → `{ scope, findings, comparison }` |
| `src/lib/generate.ts` | Generation prompt, clarification context, validation and repair |
| `src/lib/critique.ts` | Critique prompt, strict findings schema, evidence enforcement |
| `src/lib/schema.ts` | Zod schemas, commitment statuses, clarification and finding types |
| `src/lib/provenance.ts` | Quote verification, source attribution, downgrade rules |
| `src/lib/resolve.ts` | Clarification orchestration, promotion guard, injectable model calls |
| `src/lib/diff.ts` | Deterministic scope and finding comparison |
| `src/lib/markdown.ts` | Markdown export and escaping |
| `src/lib/deepseek.ts` | OpenAI-compatible chat-completions client, timeout, retries, JSON schema support |
| `tests/` | Unit and route tests |

## Tech Stack

- **Next.js 16.4.3** (App Router, Turbopack, Cache Components)
- **React 19.3**
- **TypeScript 5**
- **Tailwind CSS 4** (CSS-first configuration in `src/app/globals.css`; no `tailwind.config.ts`)
- **Zod 4** for structured output validation
- **OpenRouter** through an OpenAI-compatible chat-completions endpoint
- **Node's test runner via `tsx`** for focused TypeScript tests
- No UI component, icon, charting, or rich-text libraries

## Setup

Requirements: Node.js 20+ (Node 24 recommended), npm.

```powershell
cd "C:\Users\saxen\Downloads\Scope Guard"
npm install
Copy-Item .env.example .env.local
```

Fill in the provider key in `.env.local`. The included example targets OpenRouter:

```ini
DEEPSEEK_API_KEY=<your OpenRouter key>
DEEPSEEK_BASE_URL=https://openrouter.ai/api/v1
DEEPSEEK_MODEL=dots-studio/dots-3-note-preview:free
DEEPSEEK_TIMEOUT_MS=75000
```

`DEEPSEEK_MODEL` is required and is the single model configuration point. Do not commit `.env.local`; it is ignored.

Start the app:

```powershell
npm run dev
```

Open <http://localhost:3000>. Restart the dev server after editing `.env.local`, because environment files are read at startup.

## Testing

```powershell
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Current state:

- **57 tests pass.**
- Typecheck and ESLint pass.
- `next build` succeeds; `/` is prerendered and the three API routes are dynamic.

The tests cover:

- Commitment-status and provenance rules.
- Transcript versus clarification quote attribution.
- Confirmed versus unconfirmed clarification behavior.
- Blocking unrelated promotions to confirmed.
- Original transcript preservation.
- Scope diffs (status changes, additions, removals, problem statement).
- Findings resolved, retained, reworded, newly discovered, and unmatched.
- Failure propagation without mutating the request.
- Resolve-route validation: malformed JSON, empty answer, empty transcript, and a question that is not open.
- Markdown export, escaping, clarifications, and current-document consistency.

### Live-model verification status

The earlier analysis pipeline completed live runs against OpenRouter. **Final Phase 5 question-resolution verification was blocked by OpenRouter's free-model daily rate limit (`429 free-models-per-day`).** The resolve orchestration, promotion rules, diffs, and API validation are therefore verified with injected mock generators and route tests, not a completed live resolve. Once quota resets or credits are added, the browser workflow below is the intended end-to-end check.

## Demo Workflow

1. The app opens with the Northwind Interiors discovery transcript prefilled from `samples/discovery-call-transcript.txt`.
2. Click **Analyze**.
3. Review the generated Project Scope. Confirmed, inferred, proposed, and unresolved items are visibly separated.
4. Review **Potential delivery risks** and each finding's source evidence.
5. In **Open Questions**, click **Resolve question**.
6. Record the client's answer.
   - Leave **The client confirmed this answer** unchecked to store an unconfirmed note.
   - Check it only if the client actually confirmed the answer.
7. Click **Apply clarification**. The API regenerates the scope and reruns the critique.
8. Review **What changed**:
   - the recorded question and answer;
   - whether the question is still open;
   - added, removed, and changed scope items;
   - resolved, retained, reworded, new, and unmatched findings.
9. Optionally edit the document. Status badges remain unchanged.
10. Click **Export Markdown** to download the current document and findings.

## API Contracts

### `POST /api/analyze`

```json
{ "input": "raw transcript or brief" }
```

Returns:

```json
{ "scope": { "...": "..." }, "findings": [] }
```

### `POST /api/resolve`

```json
{
  "input": "original transcript",
  "scope": { "problemStatement": "...", "inScope": [], "outOfScope": [], "assumptions": [], "openQuestions": [], "requirements": [], "acceptanceCriteria": [], "clarifications": [] },
  "findings": [],
  "question": "selected open question",
  "answer": "client answer",
  "confirmed": true,
  "acknowledgeEdits": false
}
```

Returns:

```json
{ "scope": { "...": "..." }, "findings": [], "comparison": { "items": [], "findings": {}, "questionResolved": true, "clarification": {}, "summary": [] } }
```

Invalid requests return `400` with a concise error. Provider failures return `500` with a controlled message; the client preserves the current document and findings.

## Integrity Rules

- No fabricated quotes: evidence must appear verbatim in the transcript or a recorded clarification.
- No fabricated diffs: comparisons are computed from before/after data, not by the model.
- No fabricated success: the API returns an updated scope only after generation, provenance checks, and critique complete.
- No silent promotion: a proposed or inferred item cannot become confirmed without a client-confirmed clarification.
- No hidden reprocessing: the critique always runs after generation; it is never skipped.
- No logging of API keys, full transcripts, or raw reasoning. Diagnostics are limited to model, finish reason, token counts, and counts of dropped or downgraded items.

## Known Limitations

- **Free-tier quota:** OpenRouter's free-model daily limit currently blocks a completed live Phase 5 resolve. The app surfaces the rate-limit message and leaves the current results untouched.
- **Model quality:** The configured free model is capable but not frontier. Deterministic guards enforce evidence and promotion rules; semantic classification quality still depends on the model.
- **Promotion matching:** The promotion guard finds the previous item by exact or highly similar text. A heavily reworded promotion could bypass that match, though it still needs a verbatim quote from a confirmed source.
- **One clarification at a time:** Multiple questions are resolved sequentially, not in a batch.
- **Edited-document replacement:** Regeneration replaces manual edits after explicit UI acknowledgement; it does not merge edits field-by-field.
- **No browser E2E suite:** The editing, resolution, and export flows are covered by unit tests, route tests, typecheck, and a successful production build, but not an automated browser click-through.
- **v1 scope:** No authentication, organizations, persistent project history, live call capture, Jira/Linear integration, or collaborative editing.

## Sample Inputs

- `samples/discovery-call-transcript.txt` — a messy Northwind Interiors discovery call.
- `samples/vague-feature-request.txt` — a short, vague feature request.

These are stable regression inputs for the analysis and critique passes.