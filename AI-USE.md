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

| Milestone | Commit | AI output | Adversarial review angle | Findings fixed | Rejected or discarded | Tests added or strengthened |
|---|---|---|---|---|---|---|
| M1 Domain core | [`4c504ec`](https://github.com/licaomeng/consent-gate/commit/4c504ec), [`9d137a1`](https://github.com/licaomeng/consent-gate/commit/9d137a1) | Types, policy loader and precedence, calendar age, scenario validation, decision evaluator, and consent state machine; 67 unit tests across 5 files. | First pass: derived age, precedence, fail-closed, and consent expectations from the brief before reading the implementation. Second pass: attacked the boundary between parsing and evaluation. | First pass: no true defects; added missing coverage. Second pass: three boundary defects and one documentation gap. Details below. | Suggested moving future-DOB validation into `parseScenario`; rejected because it needs the evaluation date and `calculateAge` already enforces it on every path. The second reviewer could not reproduce the build/mutation claims because its sandbox denied writes; that was treated as an environment limitation, not evidence against the recorded results. | 52 → 67 tests. Mutation checks: removed the hard-block guard, removed jurisdiction uppercasing, relaxed the strict request shape, and removed normalization inside `resolveRule` — all four turned tests red. |

### M1 review corrections

Initial M1 implementation: [`4c504ec`](https://github.com/licaomeng/consent-gate/commit/4c504ec). Review hardening: [`9d137a1`](https://github.com/licaomeng/consent-gate/commit/9d137a1).

1. **Jurisdiction normalization depended on the caller.** `evaluateDecision` / `resolveRule` matched the raw string, so a caller that skipped `parseScenario` could pass `gb`; it fell through to the `*` consent rule while the `GB` hard block sat unused. Fix: `resolveRule` now normalizes and validates at its own boundary. Tests: raw `gb` + an approved consent → `blocked / under_minimum_age`; `g!` → `validation_error`.
2. **The shared policy was mutable and `matchedRule` leaked the internal rule object.** `readonly` is compile-time only; once the policy becomes a module singleton, a downstream mutation of a result could change later decisions. Fix: freeze the policy, the rule array, and every rule, and return a copy of `matchedRule`. Tests: mutating a frozen rule throws; mutating a result leaves the policy unchanged.
3. **Implausible birth dates satisfied every age threshold.** `0000-01-01` and `1800-01-01` were accepted. Fix: reject calendar dates before 1900 and record that choice in `DECISIONS.md`. Tests: `0000-01-01`, `1800-01-01`, and `1899-12-31` are rejected both directly and through `parseScenario`.
4. **`AI-USE.md` said the implementation tool would be recorded later.** Fix: name Claude Code as the implementation tool, add this review log, and state the verification results.

## Current verification

```text
Product implementation: M1 domain core complete ([`4c504ec`](https://github.com/licaomeng/consent-gate/commit/4c504ec), hardened in [`9d137a1`](https://github.com/licaomeng/consent-gate/commit/9d137a1)); services, HTTP routes, and UI not started
Vitest: 67 tests passing across 5 domain test files
Next.js production build: passed (Next.js 16.4.0, TypeScript check included)
Playwright: no product tests yet; starter empty-suite allowance active
npm run verify: not yet run for a product increment (the E2E suite is still empty)
Public URL: not yet verified
```

Before submission, I will record the final commit, test results, and deployed URL. Empty-suite allowances will be removed.
