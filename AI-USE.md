# AI Use

I used OpenAI Codex to analyze the brief, compare this starter with an earlier practice implementation, challenge design assumptions, and edit the documentation. I chose the product semantics, reviewed the diffs and verification output, rejected unsupported claims, and remain responsible for the submission.

The implementation tool and implementation-specific observations will be added when coding begins.

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
| M1 Domain core | Types, policy loader and precedence, calendar age, scenario validation, decision evaluator, and consent state machine; 61 unit tests across 5 files. | Derived age, precedence, fail-closed, and consent expectations from the brief before reading the implementation. | No true defects. Added missing coverage: subdivision → country fallback (`US-NY`), unknown-country wildcard match (`FR`), consent adjacency (minimum age met with a declined consent, hard block under every state, `no_matching_policy` with approval), and a decision-level February 29 transition. | Suggested moving future-DOB validation into `parseScenario`; rejected because it needs the evaluation date and `calculateAge` already enforces it on every path. | 52 → 61 tests. Mutation checks: removed the hard-block guard, removed jurisdiction uppercasing, relaxed the strict request shape — all three turned tests red. |

## Current verification

```text
Product implementation: M1 domain core complete; services, HTTP routes, and UI not started
Vitest: 61 tests passing across 5 domain test files
Next.js production build: passed (Next.js 16.4.0, TypeScript check included)
Playwright: no product tests yet; starter empty-suite allowance active
npm run verify: not yet run for a product increment (the E2E suite is still empty)
Public URL: not yet verified
```

Before submission, I will record the implementation tool, material generated work, rejected output, corrections, final commit, test results, and deployed URL. Empty-suite allowances will be removed.
