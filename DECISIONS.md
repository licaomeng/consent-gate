# Decisions

This file starts with proposed exercise decisions. During M0, confirm or revise them with the interviewer before implementation. A proposal is not interviewer-approved until its status changes.

## Status guide

- **Proposed** — prepared before the interview; awaiting confirmation.
- **Confirmed** — explicitly accepted during the interview.
- **Revised** — changed after interviewer feedback; record the final choice.
- **Deferred** — intentionally outside the exercise scope.

## Proposed baseline

### D1 — Subject identity

- **Status:** Proposed
- **Decision:** Use a stable `subjectId`; date of birth is an attribute, not identity.
- **Why:** Two users may share a birthday, while consent belongs to one subject.
- **Impact:** Decision and consent operations carry `subjectId`.

### D2 — Rule precedence

- **Status:** Proposed
- **Decision:** Exact region → country → global wildcard, independent of JSON order.
- **Why:** The most specific applicable rule should win deterministically.
- **Impact:** Test overlapping rules after changing their file order.

### D3 — Consent scope and lifecycle

- **Status:** Proposed
- **Decision:** One current record per `subjectId + jurisdiction + feature`; support `pending`, `approved`, `declined`, and reversal.
- **Why:** The latest parent choice should affect later checks without duplicate logical requests.
- **Impact:** Creation and repeated updates are idempotent; audit history is deferred.

### D4 — Read and write boundary

- **Status:** Proposed
- **Decision:** **Check access** is read-only; only **Ask a parent** creates or reuses a request.
- **Why:** Evaluation should be safe to retry and must not create state on refresh.
- **Impact:** Decision and request creation remain separate API operations.

### D5 — Consent safety boundary

- **Status:** Proposed
- **Decision:** Consent affects only a rule whose under-age action is `parental_consent`; it never overrides a hard block.
- **Why:** Parent approval cannot weaken an explicit policy prohibition.
- **Impact:** Re-check eligibility and test stale approval against hard-block rules.

### D6 — Unknown feature and missing coverage

- **Status:** Proposed
- **Decision:** Reject a feature absent from `policy.features`; for a declared feature with no applicable rule, return `blocked / no_matching_policy`.
- **Why:** Invalid input and a real policy gap are different conditions.
- **Impact:** Keep transport errors separate from fail-closed decision reasons.

### D7 — Exercise persistence

- **Status:** Proposed
- **Decision:** Use an in-memory repository behind an interface.
- **Why:** It supports the complete stateful journey within the time box.
- **Impact:** State resets on restart; PostgreSQL, concurrency, and audit events are deferred.

### D8 — API and UI boundary

- **Status:** Proposed
- **Decision:** Use four thin REST operations and one transparent page; the server owns policy decisions and explanations.
- **Why:** The exercise has a small set of explicit actions and should remain easy to inspect.
- **Impact:** The browser displays evidence but does not implement another rule matcher.

### D9 — Demo isolation

- **Status:** Proposed
- **Decision:** Each preset creates a fresh subject; manual input clears preset expectations; the parent panel shows only the active subject.
- **Why:** Earlier consent must not contaminate another walkthrough or leave stale expected results.
- **Impact:** Expected metadata never drives the actual server decision.

### D10 — Delivery and verification

- **Status:** Proposed
- **Decision:** Unit and integration tests, production build, and Playwright E2E gate delivery; empty test suites do not pass.
- **Why:** Domain correctness alone does not prove the child-to-parent journey.
- **Impact:** README, this file, and `AI-USE.md` must match the verified implementation.

## Interview changes

Record only changes made during the session:

- _None yet._

## Deferred production concerns

- Guardian authentication and guardian-subject authorization.
- Durable storage, uniqueness, concurrency control, and audit history.
- Policy versioning, rollout, expiry, and re-consent.
- Notifications, rate limits, observability, and multi-region operation.

## M0 completion gate

Before M1 begins:

- mark each implementation-critical decision **Confirmed** or **Revised**;
- record unresolved choices and their safe working assumptions;
- update `INTERVIEW_SPEC.md` if an accepted change affects the shared contract;
- do not let an agent infer an unresolved product decision from existing code.
