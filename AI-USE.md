# AI Use

I used OpenAI Codex to analyze the brief, compare this starter with an earlier practice implementation, challenge design assumptions, and edit the documentation. I chose the product semantics, reviewed the diffs and verification output, rejected unsupported claims, and remain responsible for the submission.

M1 was implemented with Claude Code as the primary agent, with a separate read-only adversarial reviewer sub-agent run after the first implementation.

## Material contributions

- Converted open requirements into explicit policy, consent, API, UI, and test contracts.
- Compared the proposed design with an earlier implementation and retained useful demo and testing ideas without copying its client-side policy logic or production claims.
- Checked consistency across the design, deployment workflow, and reviewer-facing documents.
- Established the implementation working method recorded in `AGENTS.md`: a primary agent owns contracts and integration; independent read-only agents cover orthogonal review angles; each milestone ends with focused tests, an adversarial reviewer using a different angle from the previous round, a failing test for each accepted defect, and a mutation check for each new safety rule. Results are recorded in the review log below.

## Corrections and discarded output

| Issue found in AI-assisted work | What I changed |
|---|---|
| Decision diagrams introduced reason names that disagreed with the API contract | Standardized on one set of reason codes in `docs/DESIGN.md` |
| The design claimed E2E tests gated deployment, while CI ran only coverage and build | Added Playwright installation and execution before deployment |
| The API description treated every reused consent request as `pending`, contradicting approved and declined lifecycle states | Kept new requests pending but made retries return the existing state unchanged |
| Re-evaluating eligibility before looking up an existing request could reject a retry after approval | Defined existing-scope lookup before new-request eligibility evaluation |

A local verification also failed because a stale `.next` cache referenced routes absent from the starter. I removed the generated cache and reran the build cleanly; this was an environment issue, not accepted application behavior.

## Per-milestone review log

One row per milestone, added when the milestone closes, as required by the per-milestone review protocol in `AGENTS.md`. Keep entries factual and short.

| Milestone | AI output | Adversarial review angle | Findings fixed | Rejected or discarded | Tests added or strengthened |
|---|---|---|---|---|---|
| M1 Domain core | Types, policy loader and precedence, calendar age, scenario validation, decision evaluator, and consent state machine; 67 unit tests across 5 files. | First pass: derived age, precedence, fail-closed, and consent expectations from the brief before reading the implementation. Second pass: attacked the boundary between parsing and evaluation. | First pass found no true defects; added missing coverage (subdivision → country fallback, unknown-country wildcard, consent adjacency, decision-level February 29). Second pass found: `resolveRule` trusted pre-normalized input, so a raw lowercase `gb` could skip the GB hard block; the frozen-policy/matchedRule reference could be mutated; dates before 1900 were accepted. Fixed all three. | Suggested moving future-DOB validation into `parseScenario`; rejected because it needs the evaluation date and `calculateAge` already enforces it on every path. The second reviewer could not reproduce the build/mutation claims because its sandbox denied writes; that was treated as an environment limitation, not evidence against the recorded results. | 52 → 67 tests. Mutation checks: removed the hard-block guard, removed jurisdiction uppercasing, relaxed the strict request shape, and removed normalization inside `resolveRule` — all four turned tests red. |

## Current verification

```text
Product implementation: M1 domain core complete; services, HTTP routes, and UI not started
Vitest: 67 tests passing across 5 domain test files
Next.js production build: passed (Next.js 16.4.0, TypeScript check included)
Playwright: no product tests yet; starter empty-suite allowance active
npm run verify: not yet run for a product increment (the E2E suite is still empty)
Public URL: not yet verified
```

Before submission, I will record the final commit, test results, and deployed URL. Empty-suite allowances will be removed.
