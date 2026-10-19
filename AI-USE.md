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

One row per milestone, added when the milestone closes, as required by the per-milestone review protocol in `AGENTS.md`. Keep entries factual and short. **Source** separates the agent's own adversarial review from issues the human found while reviewing the code diff during the mock interview.

| Milestone | Source | Commit | AI output | Review angle | Findings fixed | Rejected or discarded | Tests added or strengthened |
|---|---|---|---|---|---|---|---|
| M1 Domain core | Agent reviewer (test gaps) + user review (defects) | [`4c504ec`](https://github.com/licaomeng/consent-gate/commit/4c504ec), [`9d137a1`](https://github.com/licaomeng/consent-gate/commit/9d137a1) | Types, policy loader and precedence, calendar age, scenario validation, decision evaluator, and consent state machine; 67 unit tests across 5 files. | Agent pass: derived age, precedence, fail-closed, and consent expectations from the brief before reading the implementation. User pass: inspected the code diff during the mock interview and attacked the parsing/evaluation boundary. | Agent pass: no true defects; added missing coverage. User pass: three boundary defects and one documentation gap. Details below. | Suggested moving future-DOB validation into `parseScenario`; rejected because it needs the evaluation date and `calculateAge` already enforces it on every path. The user-side reviewer could not reproduce the build/mutation claims because its sandbox denied writes; that was treated as an environment limitation, not evidence against the recorded results. | 52 → 67 tests. Mutation checks: removed the hard-block guard, removed jurisdiction uppercasing, relaxed the strict request shape, and removed normalization inside `resolveRule` — all four turned tests red. |
| M2 Services and HTTP | Agent reviewer + user review | [`16f130d`](https://github.com/licaomeng/consent-gate/commit/16f130d) (initial M2), [`ccbc854`](https://github.com/licaomeng/consent-gate/commit/ccbc854) (review fixes) | In-memory repository behind an interface, decision and consent services, gated server clock, global composition root, error mapping, and the four `/api/v1` routes; 123 tests across 11 files; real HTTP smoke against `next start`. | Agent pass: HTTP/API contract, error mapping, read/write boundary, idempotency and operation order, and repository-failure behavior. User pass: startup configuration, observability, and the development-time singleton. | Agent pass: one true defect (lazy configuration returned 400), one latent hazard (`created` inferred from the lookup), five test gaps. User pass: blank test-clock override crashed startup, production could freeze dates, 503/500 were unlogged, and the container was a module-local singleton. One user finding was rejected. Details below. | Agent pass: README/AI-USE staleness was deferred to M4; no style or architecture preferences accepted. User pass: 404-on-vanished-row rejected as outside the exercise's concurrency guarantees. | 106 → 123 tests. Twelve mutation checks, all red: checkAccess creating state, existing lookup bypassed, hard block creating, swapped error statuses, missing subjectId validation, `created` ignoring the write result, missing startup clock validation, blank override, missing test-clock gate, both missing logs, and a per-call container. |
| M3 Page and E2E | Agent reviewer + user review | [`dfe27ed`](https://github.com/licaomeng/consent-gate/commit/dfe27ed) (initial M3), [`d8bc9be`](https://github.com/licaomeng/consent-gate/commit/d8bc9be) (second-review fixes) | Single-page UI, pure workflow/action matrix, eight demo presets, and eleven browser journeys; 164 Vitest tests across 13 files; 11 Playwright tests. | Agent pass: front-end state machine, action matrix, stale responses, no optimistic updates, accessibility, and preset isolation. User pass: date-relative demo data, E2E clock isolation, input locking during writes, and documentation consistency. | Agent pass: seven true defects (pending Ask, scope normalization, unreadable state, preset hint, waiting state, stale refresh, live regions). User pass: four defects (fixed-date presets, E2E server reuse, AI-USE contradictions, editable inputs during a write). Details below. | Agent pass: the verified-correct list was accepted. User pass: none rejected; all four were valid. | 139 → 164 Vitest tests; 10 → 11 Playwright journeys. Six mutation checks, all red: hard block offering Ask, pending request re-asking, inverted approve matrix, scope match ignoring feature, demo expectation drift, and input locking during a write. Coverage: 98.47% statements, 94.73% branches. |

### M1 review corrections

Initial M1 implementation: [`4c504ec`](https://github.com/licaomeng/consent-gate/commit/4c504ec). Review hardening: [`9d137a1`](https://github.com/licaomeng/consent-gate/commit/9d137a1). All four findings below came from the **user's own review**, not from the agent's first-pass reviewer.

1. **[User review] Jurisdiction normalization depended on the caller.** `evaluateDecision` / `resolveRule` matched the raw string, so a caller that skipped `parseScenario` could pass `gb`; it fell through to the `*` consent rule while the `GB` hard block sat unused. Fix: `resolveRule` now normalizes and validates at its own boundary. Tests: raw `gb` + an approved consent → `blocked / under_minimum_age`; `g!` → `validation_error`.
2. **[User review] The shared policy was mutable and `matchedRule` leaked the internal rule object.** `readonly` is compile-time only; once the policy becomes a module singleton, a downstream mutation of a result could change later decisions. Fix: freeze the policy, the rule array, and every rule, and return a copy of `matchedRule`. Tests: mutating a frozen rule throws; mutating a result leaves the policy unchanged.
3. **[User review] Implausible birth dates satisfied every age threshold.** `0000-01-01` and `1800-01-01` were accepted. Fix: reject calendar dates before 1900 and record that choice in `DECISIONS.md`. Tests: `0000-01-01`, `1800-01-01`, and `1899-12-31` are rejected both directly and through `parseScenario`.
4. **[User review] `AI-USE.md` said the implementation tool would be recorded later.** Fix: name Claude Code as the implementation tool, add this review log, and state the verification results.

### M2 review corrections

Initial M2 implementation: [`16f130d`](https://github.com/licaomeng/consent-gate/commit/16f130d). Review fixes: [`ccbc854`](https://github.com/licaomeng/consent-gate/commit/ccbc854).

1. **[Agent reviewer] Configuration failures were lazy and reported as client errors.** The container loaded the policy and read the evaluation date on the first request, so an invalid `policy.json` or `CONSENT_GATE_EVALUATION_DATE` produced `400 validation_error` — a client-blaming answer for a server misconfiguration. Fix: the container is created eagerly at module load (build/startup) and validates the clock at construction. Test: `createContainer()` throws when the evaluation date is invalid.
2. **[Agent reviewer] `created` was inferred from the pre-write lookup.** A conforming production repository can deduplicate inside `create` (unique constraint), so answering `201 created:true` from the earlier lookup could lie. Fix: `create` returns `{ request, created }`; the service reports `created` from the write result. Test: a repository whose lookup misses but whose write deduplicates returns `created:false`.
3. **[Agent reviewer + mutation check] Test gaps closed.** Route-level `503` for all four operations, read-only `POST /decisions` proven over HTTP, subject isolation over HTTP, `409` for adults and coverage gaps, error-message presence, and the policy-drift case where an existing record must be returned before re-evaluating eligibility under a new hard-block policy.
4. **[User review] A blank test-clock override crashed startup, and production could freeze every age.** `?.trim()` returned `""`, which `??` treated as set, so `CONSENT_GATE_EVALUATION_DATE=""` reached `parseCalendarDate` and failed during eager container creation. Separately, an accidental production value would freeze the evaluation date. Fix: blank means unset, and the override is honored only with the explicit `CONSENT_GATE_ALLOW_TEST_CLOCK=1` opt-in. Tests cover blank, absent flag, present flag, invalid value, and the in-process pin taking precedence.
5. **[User review] 503 and 500 responses were unlogged.** The routes caught every error, so operators saw no stack trace. Fix: `console.error` before returning 503 or 500; expected 4xx errors are not logged and response bodies are unchanged. Tests assert one log for each server error and none for domain errors.
6. **[User review] The container was a module-local singleton.** A Next.js module reload could reset the in-memory consent store mid-demo. Fix: store the container on `globalThis`, the standard shared-singleton pattern. Test: repeated reads return the same instance and replacement/reset still work.
7. **[User review, rejected] A row vanishing between `getById` and `updateStatus` should return 404 instead of 503.** Rejected: the in-memory repository never deletes, there is no `await` between the check and the write, and `DECISIONS.md` explicitly places cross-process concurrency outside the exercise's guarantees. The boundary is documented on the repository interface: the pre-write `getById` owns the 404; a write failure is a storage inconsistency (503).

### M3 review corrections

All seven findings below came from the **agent's adversarial reviewer**.

1. **"Ask a parent" could reappear for a pending request.** `actionsFor` keyed only on `decision === "parental_consent"`, so a decision with reason `parental_consent_pending` and no locally-found request exposed the explicit write again. Fix: require `reason === "parental_consent_required"`; tests cover the pending reason.
2. **Client scope matching ignored jurisdiction normalization.** The raw draft (`de`, ` DE `) was compared with the server-normalized request (`DE`), so an existing pending request was missed. Fix: use `decision.lookupPath[0]` (the server-normalized jurisdiction) for the scope match instead of duplicating the normalization rule. E2E: type `de` after creating a request and still see it.
3. **A failed consent-state read was converted to "no request".** A non-2xx `GET /consent-requests` returned `null`, which re-exposed Ask. Fix: throw and abort the check with an alert; never manufacture "no request". E2E intercepts the GET with 503.
4. **Preset expected outcome and purpose were never shown.** DESIGN §4 requires them before evaluation. Fix: presets carry a `purpose`, and selecting one renders `expected` + `purpose`; the contract test keeps the expectation aligned with the engine.
5. **No "Waiting for parent" state.** Fix: render it when the decision reason is `parental_consent_pending`; asserted in the consent-loop journey.
6. **A failed post-action refresh kept stale evidence.** If PATCH succeeded and the fresh decision failed, the old decision sat beside the new request status. Fix: clear the decision and show a retryable error; the confirmed request stays visible per DESIGN §5. E2E fails the second decision call.
7. **Progress and request status were not announced.** Fix: a `role="status"` live region for the phase and `aria-live` on the parent status. E2E asserts "Checking access…" while a delayed check is in flight.

### M3 second review corrections

Initial M3 implementation: [`dfe27ed`](https://github.com/licaomeng/consent-gate/commit/dfe27ed). Second-review fixes: [`d8bc9be`](https://github.com/licaomeng/consent-gate/commit/d8bc9be). All four findings below came from the **user's review**.

1. **[User review] Preset expectations were tied to a fixed date.** DOBs were hardcoded and the contract test pinned `2026-10-19`, while the server uses its current date; from 2027 the California preset, and later others, would show an expectation the engine no longer returned. Fix: presets carry an age, and the DOB is derived from the server's evaluation date (the page is dynamic and receives that date). The contract test now runs every preset on four dates through 2040.
2. **[User review] E2E could silently reuse an unrelated server.** `reuseExistingServer: true` on port 3000 meant a local dev server would be reused without the pinned clock environment. Fix: a dedicated port (3100), `reuseExistingServer: false`, and the consent-loop journey asserts `evaluatedAt` is the pinned date.
3. **[User review] `AI-USE.md` contradicted itself.** The verification block still said "no product tests yet" and "verify not yet run" beside "10 journeys passing". Fix: the stale lines were removed and the actual `npm run verify` result is recorded; empty-suite allowances are still noted as an M4 task.
4. **[User review] Scenario inputs stayed editable during an in-flight write.** Editing during `creating_request` or `updating_request` invalidated the token and dropped a response after the server may have committed it. Fix: the three inputs are disabled while busy and `updateDraft` refuses changes during a write. A Playwright journey locks the jurisdiction input during a delayed PATCH. Because operations are now serialized, the request-token guard is defence in depth rather than a reachable path; its pure function remains unit-tested.

## Current verification

```text
Product implementation: M1 domain core complete ([`4c504ec`](https://github.com/licaomeng/consent-gate/commit/4c504ec), hardened in [`9d137a1`](https://github.com/licaomeng/consent-gate/commit/9d137a1)); M2 services and HTTP routes complete ([`16f130d`](https://github.com/licaomeng/consent-gate/commit/16f130d), review fixes in [`ccbc854`](https://github.com/licaomeng/consent-gate/commit/ccbc854)); M3 page and E2E complete ([`dfe27ed`](https://github.com/licaomeng/consent-gate/commit/dfe27ed), second-review fixes in [`d8bc9be`](https://github.com/licaomeng/consent-gate/commit/d8bc9be))
Vitest: 164 tests passing across 13 test files
Coverage: 98.47% statements, 94.73% branches, 100% functions
Playwright: 11 journeys passing (consent loop, hard block, coverage gap, precedence, preset hint, lowercase scope, unreadable state, failed refresh, input lock, live progress, input change clears results)
Next.js production build: passed; the page is dynamic and all four `/api/v1` operations are registered
HTTP smoke: 8/8 checks against `next start` (evaluate, create, reuse, approve, re-evaluate, list, hard block, client date rejection)
npm run verify: passed (coverage + production build + 11 Playwright journeys)
Empty-suite allowances: still active until M4 removes them
Public URL: not yet verified
```

Before submission, I will record the final commit, test results, and deployed URL. Empty-suite allowances will be removed.
