# Scope Guard

**Catch scope creep before it becomes costly rework.**

Scope Guard turns messy discovery conversations into clear, evidence-backed project scopes — with assumptions, contradictions, and unanswered questions surfaced before development begins.

The product is built for the OpenFire Hackathon, but the pipeline is designed as a real working tool rather than a static demo. A model generates a structured scope, a separate review pass critiques it against the original source, and deterministic checks keep uncertainty visible instead of presenting it as agreement.

## What Scope Guard Does

- Converts a discovery transcript, meeting notes, or rough project brief into a structured scope document.
- Separates four commitment states:
  - **Confirmed** — directly supported by a source quotation.
  - **Inferred** — a reasonable interpretation with a stated rationale.
  - **Proposed** — an option or recommendation that still needs client approval.
  - **Unresolved** — an open decision or dependency.
- Verifies quoted evidence against the original transcript and recorded client clarifications.
- Runs an independent Scope Guard review for ambiguity, contradictions, missing information, and unsupported assumptions.
- Reconciles review findings back into the scope without weakening provenance or promotion safeguards.
- Records client clarifications separately from the transcript. A tentative answer remains a note; it does not become a confirmed commitment.
- Produces a deterministic comparison when a clarification changes the analysis.
- Exports a structured PDF report with commitments, findings, evidence, clarifications, open questions, and change details.
- Accepts audio recordings through browser recording or file upload, then transcribes them into the same editable source field.

Scope Guard does not act as an autonomous project manager, estimation platform, contract generator, or a guarantee that scope creep cannot happen. It helps teams see what is supported, what is uncertain, and what still needs a decision.

## How Scope Guard Processes a Brief

| Stage | Executed by | What happens | What protects the result |
|---|---|---|---|
| 1. Source intake | Deterministic UI | Paste, record, or upload source material into one editable transcript field. | The original transcript is never rewritten. Transcription never starts analysis automatically. |
| 2. Structured generation | Model + deterministic checks | Generate problem statement, scope sections, requirements, and acceptance criteria with statuses. | Zod shape validation, verbatim quote repair, unsupported-commitment downgrade, and tentative-language checks. |
| 3. Independent review | Model + deterministic checks | Critique the status-labelled scope against the source for ambiguity, contradictions, missing information, and unsupported assumptions. | Findings require a verbatim source snippet. Fabricated evidence is dropped, duplicate evidence is collapsed, and proposal/status misstatements are filtered. |
| 4. Conditional reconciliation | Model + deterministic checks | Only when the review contains a contradiction or unsupported assumption: repair the scope, revalidate it, and re-review it. | One bounded repair pass, a second evidence check, and fail-closed confirmed-conflict detection. |
| 5. Clarification | Model + deterministic checks | Record a client answer, regenerate the scope, re-run review, and compare before/after results. | Unconfirmed notes never promote commitments. A proposal cannot become confirmed without a client-confirmed quote. |
| 6. Reporting | Deterministic | Build distinct-decision counts, PDF preflight, and a client-shareable PDF. | Counts dedupe repeated representations, unresolved questions remain visible, and export actions preserve the current state. |

A normal analysis uses **two model calls**. A reconciliation pass adds two more only when a conflict-type finding warrants repair. Every model call uses one absolute pipeline deadline; no stage or retry resets the full budget.

## Hackathon Attribution

**Built with Alan AI · Created for OpenFire Hackathon 2026**

The attribution also appears at the bottom of the landing page.

## Product Surfaces

| Route | Purpose |
|---|---|
| `/` | Marketing landing page with product narrative, kinetic motion, and an interactive pipeline comparison. |
| `/workspace` | The working Scope Guard application: source intake, analysis, review, clarifications, comparison, and PDF export. |
| `POST /api/analyze` | Runs generation, critique, and reconciliation for a source brief. |
| `POST /api/resolve` | Applies a clarification, regenerates the scope, re-runs review and reconciliation, and returns a comparison. |
| `POST /api/transcribe` | Transcribes recorded or uploaded audio on the server. |
| `GET /api/hello` | Provider connectivity diagnostic. |

The landing page calls to action point to `/workspace`; the GitHub button points to the repository.

## Core Capabilities

### Evidence-backed scope generation

`generateScope()` requests a schema-shaped scope document, then `repairScopeProvenance()` checks quoted support. Unsupported confirmed or inferred items are downgraded to proposals instead of being presented as client agreement. Valid quotes are retained so a supported proposal remains distinguishable from an invented one.

### Commitment-status model

Status is part of the document contract, not a cosmetic label. A proposal or inference cannot silently become confirmed during regeneration. Promotion requires a quotation from a client-confirmed clarification.

### Independent review and reconciliation

`critiqueScope()` reviews the status-labelled scope against the source material. Findings must include a verbatim source snippet; fabricated evidence is rejected and duplicate evidence is collapsed.

`reconcileCritique()` performs one bounded repair pass:
- the critique is sent back through generation;
- the returned scope is repaired and validated again;
- the scope is re-reviewed;
- unresolved contradictions between confirmed commitments and reliable source evidence fail closed, preserving the previous valid results.

### Clarifications and change tracking

Users resolve one open question at a time by recording the client's answer and marking whether the client actually confirmed it.

- Unconfirmed answers are stored as notes.
- Unconfirmed notes cannot promote proposed or unresolved commitments.
- A confirmed answer can update the scope only when its evidence supports the change.
- Manual edits require explicit acknowledgement before regeneration replaces them.
- `compareScopes()` reports added, removed, changed, and section-moved scope items, plus resolved, retained, reworded, new, and not-re-reported findings.
- A proposed item that remains proposed does not count as a resolved finding.

### Reporting and PDF export

PDF export builds a paginated, client-shareable report in the browser with `pdfmake`. It includes the current edited scope, status labels, evidence quotations, findings, clarifications, and available change history.

The preflight warning uses the actual unresolved-question count. It offers two actions:
- **Review questions** navigates to the first unresolved question.
- **Download draft** exports the current scope with unresolved items still visibly marked.

The executive summary counts distinct decisions rather than duplicate section entries. Identical representations across Requirements and Acceptance Criteria count once, while genuinely distinct commitments and different statuses stay separate.

### Audio intake

The source panel offers three modes:

- **Paste** — paste a transcript, meeting notes, or brief.
- **Record** — record a conversation in the browser and transcribe it.
- **Upload** — upload an existing audio file and transcribe it.

Transcription never starts analysis automatically. When transcription succeeds, an empty source field is populated. If the field already contains text, the user chooses Replace, Append, or Cancel. Failures and cancellation preserve the existing source text.

### Landing experience

The landing page at `/` presents the product narrative through:
- an animated kinetic hero;
- problem and solution sections;
- a three-step workflow;
- a six-feature product showcase;
- a trust/evidence comparison;
- verified technology cards;
- an interactive two-pipeline demonstration contrasting an unvalidated brief with a Scope Guard-assisted workflow.

Motion respects `prefers-reduced-motion`, and the page degrades to readable final states when animation is unavailable.

## Analysis Pipeline

```text
Source transcript / brief
          │
          ▼
   generateScope()
          │
          ├── rawScopeSchema validation
          ├── repairScopeProvenance()
          └── scopeSchema validation
          │
          ▼
    critiqueScope()
          │
          ├── findings schema validation
          ├── enforceFindingProvenance()
          └── scope-consistency finding filter
          │
          ├── no contradiction / unsupported assumption → return 2-call result
          │
          ▼
  reconcileCritique()   (only when the review indicates a scope repair)
          │
          ├── one generation repair pass
          ├── provenance repair
          ├── re-review
          └── confirmed-conflict guard
          │
          ▼
  Scope + findings returned to the workspace
```

A normal analysis uses **two model calls**: generation and independent review. A bounded reconciliation pass adds two more calls only when the review contains a contradiction or unsupported assumption that may require changing the scope. Purely informational findings — ambiguity and missing information — do not trigger repeated generation.

Every model call shares one absolute pipeline deadline (`SCOPE_GUARD_PIPELINE_TIMEOUT_MS`, default 75 seconds). The deadline is enforced before each stage and inside the provider client, so a slow call cannot keep the request alive indefinitely. Timeouts fail with a clear `504` response instead of returning a partial scope as if analysis succeeded. Validated results from completed stages are retained for diagnostics, but are never returned as a successful full analysis.

When a clarification is applied, `resolveScope()` additionally:
- validates the selected open question;
- preserves unrelated confirmed commitments;
- blocks unsupported promotions to confirmed;
- preserves the latest clarification history;
- shares the same absolute pipeline deadline as first-pass analysis;
- computes the deterministic before/after comparison.

The original transcript is never rewritten. Clarifications are stored separately as `{ id, question, answer, confirmed }`. Scope items and findings record `sourceKind` (`transcript` or `clarification`) and, where applicable, `clarificationId`.

## Tech Stack

- **Next.js 16.4.3** — App Router, server routes, static landing page.
- **React 19.3** — interactive workspace and landing-page motion components.
- **TypeScript 5** — type-safe application, analysis, and test code.
- **Tailwind CSS 4** — responsive layout and visual system.
- **Zod 4** — runtime validation for scope, clarification, and finding contracts.
- **OpenRouter** — model API access through an OpenAI-compatible chat-completions client.
- **pdfmake 0.3.13** — client-side PDF report generation.
- **Next.js Font Optimization** — Geist for UI text and Fraunces for editorial display type.
- **Node test runner + `tsx`** — deterministic unit, route, pipeline, and regression tests.

No UI component library, charting library, or rich-text editor is used. The landing-page illustration and product mockups are built from CSS, SVG, and representative product data.

## Project Structure

| Path | Responsibility |
|---|---|
| `src/app/page.tsx` | Landing page entry point and metadata. |
| `src/app/workspace/page.tsx` | Working application route. |
| `src/components/landing/` | Landing page composition, navigation, motion, icons, and pipeline comparison. |
| `src/components/scope-workspace.tsx` | Source intake, results, editing, review, clarifications, comparison, PDF preflight, and export. |
| `src/components/scope-input.tsx` | Three source modes, transcription handoff, source status, and analysis action. |
| `src/components/scope-nav.tsx` | Workspace section navigation. |
| `src/app/api/analyze/route.ts` | Generation, critique, reconciliation, and validated analysis response. |
| `src/app/api/resolve/route.ts` | Clarification application and comparison response. |
| `src/app/api/transcribe/route.ts` | Audio upload validation and server-side transcription. |
| `src/lib/generate.ts` | Generation prompt, clarification context, schema validation, and provenance repair. |
| `src/lib/critique.ts` | Critique prompt, findings schema, evidence enforcement, and consistency filtering. |
| `src/lib/provenance.ts` | Quote verification, source attribution, downgrade rules, and finding/scope consistency checks. |
| `src/lib/reconcile.ts` | Bounded repair pass and confirmed-conflict guard. |
| `src/lib/resolve.ts` | Clarification orchestration, promotion guard, and comparison orchestration. |
| `src/lib/diff.ts` | Deterministic scope/finding comparison and change classification. |
| `src/lib/commitments.ts` | Distinct-decision aggregation for executive counts. |
| `src/lib/clarifications.ts` | Unresolved-question preflight and PDF action routing. |
| `src/lib/pdf-export.ts` | PDF document definition and client download. |
| `src/lib/schema.ts` | Zod schemas, statuses, clarifications, and findings. |
| `src/lib/deepseek.ts` | OpenAI-compatible provider client, model override, timeout, retries, and structured output support. |
| `src/lib/analysis-pipeline.ts` | Two-call analysis orchestration, conditional reconciliation, stage timing, and shared pipeline deadline. |
| `src/lib/analysis-state.ts` | Atomic result state, analysis labels, and loading guidance. |
| `tests/` | Unit, route, pipeline, provenance, comparison, and PDF tests. |

## Getting Started

Requirements: Node.js 20+ (Node 24 recommended), npm.

```powershell
npm install
Copy-Item .env.example .env.local
```

Fill in the provider key in `.env.local`. The current example targets OpenRouter:

```ini
DEEPSEEK_API_KEY=<your OpenRouter key>
DEEPSEEK_BASE_URL=https://openrouter.ai/api/v1
DEEPSEEK_MODEL=dots-studio/dots-3-note-preview:free
# Optional faster/reliable analysis model override:
# SCOPE_GUARD_MODEL=<openrouter-compatible-model-id>
OPENROUTER_TRANSCRIPTION_MODEL=openai/gpt-transcribe
# Per model call budget (default 60000):
# DEEPSEEK_TIMEOUT_MS=60000
# Retry attempts for transient provider failures (default 2, maximum 3):
# DEEPSEEK_MAX_ATTEMPTS=2
# Overall analysis budget (default 75000):
# SCOPE_GUARD_PIPELINE_TIMEOUT_MS=75000
```

`DEEPSEEK_MODEL` is the required fallback analysis model. `SCOPE_GUARD_MODEL` optionally overrides it without editing source code — set it to a faster OpenRouter-compatible model id when analysis latency is a problem. `OPENROUTER_TRANSCRIPTION_MODEL` is used only for audio transcription and defaults to `openai/gpt-transcribe` in the adapter.

The provider client retries transient failures within the call and pipeline budgets. A per-attempt timeout is never retried, because retrying a timeout makes the total request slower. The overall pipeline budget remains the hard limit even when retries are available.

### Model selection

The analysis model must support OpenAI-compatible chat completions, `response_format` with strict JSON schema, `max_tokens`, and optional reasoning that can be disabled. OpenRouter determines structured-output support per endpoint, not just per model.

At the time of the model review, the recommended paid pairing was:

| Role | Model | Reason |
|---|---|---|
| Primary | `openai/gpt-5.6-luna` | All 7 endpoints advertised structured outputs; roughly 1.05M context; fast/cost-efficient model positioning; about $0.20/M input and $1.20/M output. |
| Fallback | `google/gemini-3.1-flash-lite` | All 8 endpoints advertised structured outputs; low-latency/high-volume positioning; about $0.25/M input and $1.50/M output. |

Recommended production configuration:

```ini
SCOPE_GUARD_MODEL=openai/gpt-5.6-luna
DEEPSEEK_MODEL=google/gemini-3.1-flash-lite
```

`SCOPE_GUARD_MODEL` is the active override. `DEEPSEEK_MODEL` is a configuration fallback used only when the override is unset — it is not automatic runtime failover. To use the fallback, set it as the override or remove `SCOPE_GUARD_MODEL` and restart.

Paid models avoid the free-model request cap (20 requests/minute; 50/day below $10 in credits, 1,000/day above). Free preview models are useful for development but are not recommended for a judged live demo. Model IDs, endpoint support, and prices can change; verify them against the current OpenRouter catalogue before deploying.

Never commit `.env.local`. It is ignored.

Start the app:

```powershell
npm run dev
```

Open <http://localhost:3000> for the landing page and <http://localhost:3000/workspace> for the analysis workspace. Restart the dev server after changing `.env.local`.

## Verification

Run:

```powershell
npm test
npx tsc --noEmit
npx eslint src tests
npm run build
git diff --check
```

Current state:

- **186 tests pass.**
- TypeScript and ESLint pass.
- The production build succeeds.
- `/` and `/workspace` are prerendered; API routes remain dynamic.

The suite covers commitment status and provenance, supported proposals, tentative language, clarification states, promotion guards, deterministic diffs, finding resolution, distinct-decision counts, PDF preflight actions, PDF content, source-text handoff, transcription routes, analysis state, and API error mapping.

Browser-based end-to-end interaction tests are not automated. Responsive layout, recording permissions, file uploads, and download behavior should be checked manually against the deployment environment.

## Demo Workflow

1. Open `/` and review the product narrative and pipeline comparison.
2. Select **Try Scope Guard** to enter `/workspace`.
3. The workspace starts with the Northwind Interiors discovery transcript from `samples/discovery-call-transcript.txt`.
4. Select **Analyze**. After results exist, the action becomes **Re-analyze**.
5. Review the scope, the status legend, and **Scope Guard Review** findings with their source evidence.
6. Open **Open Questions** and choose **Resolve question**.
7. Record the client's answer and mark whether it was actually confirmed.
8. Apply the clarification. Confirm that the scope, findings, clarification state, and **What changed** comparison remain consistent.
9. Optionally edit the document. Status labels remain read-only.
10. Select **Download PDF**. If unresolved questions remain, review the preflight warning or download the draft with unresolved items still identified.

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
  "scope": {
    "problemStatement": "...",
    "inScope": [],
    "outOfScope": [],
    "assumptions": [],
    "openQuestions": [],
    "requirements": [],
    "acceptanceCriteria": [],
    "clarifications": []
  },
  "findings": [],
  "question": "selected open question",
  "answer": "client answer",
  "confirmed": true,
  "acknowledgeEdits": false
}
```

Returns:

```json
{
  "scope": { "...": "..." },
  "findings": [],
  "comparison": {
    "items": [],
    "findings": {},
    "questionResolved": true,
    "clarification": {},
    "summary": []
  }
}
```

Invalid requests return `400` with a concise error. Reconciliation failures return `422` when the generated scope cannot be validated or a confirmed decision still conflicts with reliable evidence. Provider failures return controlled `5xx` messages; the client preserves the current document and findings.

## Integrity and Safety Rules

- No fabricated quotes: evidence must appear verbatim in the transcript or a recorded clarification.
- No silent promotion: proposed and inferred items cannot become confirmed without a client-confirmed clarification.
- No automatic confirmation from a note: unconfirmed clarifications remain provisional.
- No false resolution: a finding is not marked resolved merely because a feature moved or was reworded.
- No hidden duplicates in executive counts: repeated representations of one decision count once, while distinct commitments remain separate.
- No fabricated diffs: comparisons are computed from before/after data.
- No skipped review: critique runs after generation, and reconciliation is bounded to one repair pass.
- No rewriting the source: the original transcript is preserved exactly.
- No destructive failure: failed analysis or reconciliation leaves the previous valid results and clarification data intact.
- No secret logging: API keys, full transcripts, and raw reasoning are not logged. Diagnostics are limited to model metadata, finish reason, token counts, and counts of dropped or downgraded items.

## Known Limitations

- Model quality still depends on the configured provider and model. Deterministic guards enforce evidence and promotion rules but cannot make semantic review perfect.
- The free OpenRouter model can be rate-limited or unavailable. Failures preserve the current results but stop the requested analysis.
- Promotion matching uses exact or highly similar wording. A heavily reworded promotion still requires a confirmed-source quotation but may not be matched to its previous item.
- Clarifications are applied one at a time, not in a batch.
- Regeneration replaces manual edits after explicit acknowledgement; it does not merge edits field by field.
- PDF output is generated client-side and should be visually reviewed after dependency or layout changes.
- No authentication, organizations, persistent project history, Jira/Linear integration, or collaborative editing.
- No automated browser end-to-end suite covers recording, uploading, responsive navigation, or PDF download interaction.

## Sample Inputs

- `samples/discovery-call-transcript.txt` — messy Northwind Interiors discovery call.
- `samples/northstar-dental-transcript.txt` — dental clinic brief with tentative decisions.
- `samples/vague-feature-request.txt` — short, vague feature request.

These are stable inputs for analysis and regression testing.

## Product Boundaries

Scope Guard is a scoping and review aid. It does not:
- make final project commitments on behalf of a client;
- estimate cost or delivery effort;
- generate contracts;
- guarantee complete requirements or eliminate scope risk;
- replace human review of a project brief.

Its purpose is to expose ambiguity, preserve uncertainty, and help teams identify what needs clarification before implementation.
