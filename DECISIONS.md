# Decisions

The brief leaves several behaviors open. This file records the choices that materially affect the implementation. Detailed contracts live in [`docs/DESIGN.md`](docs/DESIGN.md); production extensions live in [`docs/PRODUCTION_NOTES.md`](docs/PRODUCTION_NOTES.md).

These are proposed implementation decisions. The README records what has actually been delivered and verified.

## At a glance

| Decision | Why | Accepted cost |
|---|---|---|
| Scope consent by subject, jurisdiction, and feature | Prevent consent from leaking between children or use cases | The demo needs a synthetic `subjectId` |
| Exact subdivision → country → `*` | Deterministic specificity matches the supplied policy | Real jurisdiction hierarchies need explicit production data |
| Keep access checks read-only | Refreshes and retries must not create requests | The product needs an explicit **Ask a parent** action |
| Treat hard blocks as non-overridable | Consent is valid only where policy permits it | An old approval may be ignored by a stricter current rule |
| Fail closed on missing coverage | A configuration gap must not grant access | The UI must distinguish a gap from an explicit prohibition |
| Store one reversible current state | Supports approve, decline, and change-of-mind behavior simply | No immutable audit history in the exercise |
| Use an in-memory repository behind an interface | Keeps the take-home focused on policy and workflow semantics | State is neither durable nor cross-instance |
| Keep policy evaluation on the server | Prevents browser and server rules from drifting | The server must return enough evidence for a transparent UI |

## Identity and consent scope

Consent is keyed by `subjectId + jurisdiction + feature`. DOB is an attribute, not an identifier: two children may share a birthday, and one child may have different consent outcomes for different features or jurisdictions.

The demo accepts a synthetic `subjectId` because accounts and authentication are outside the brief. A real product would derive the subject and guardian relationship from authenticated profiles. Production scope may also include product, purpose, policy version, and expiry.

## Rule resolution

The evaluator checks an exact subdivision, then its country, then the global `*` rule. File order never determines the winner. Combining several matching rules would require conflict semantics that the brief does not provide.

This hierarchy fits the supplied `US-CA` and `US-TX` data. A production policy should model jurisdiction inheritance explicitly rather than assuming every location can be derived by splitting a string.

## Consent lifecycle

One mutable record represents the current state for a consent scope. It begins as `pending`, may become `approved` or `declined`, and may move between those resolved states when a parent changes their mind.

Creating the same scope returns the existing record before new-request eligibility is evaluated. This preserves idempotent retries even when that record is already approved or declined. Repeating its current target state is also safe. These business rules do not solve simultaneous opposing writes across processes; production would add a unique scope constraint, a version check such as `If-Match`, and immutable audit events.

## Read and write boundary

**Check access** is read-only. **Ask a parent** is the explicit operation that creates or reuses a request. Decision checks may run during refresh, retry, prefetch, or background work; allowing them to create state could generate unintended requests or notifications.

The server re-evaluates the scenario before creating a request. A client cannot claim that consent is available for an already allowed feature or for a hard block.

## Hard blocks and missing coverage

Consent affects only a winning rule whose under-age action is `parental_consent`. It never overrides `blocked`, including when an older approval exists.

An undeclared feature is invalid input. A declared feature with no applicable rule is a policy coverage gap, so the exercise fails closed as `blocked / no_matching_policy`. The distinct reason allows monitoring and a neutral user message instead of presenting the gap as an explicit legal prohibition.

## Dates and input normalization

DOB is parsed as a real `YYYY-MM-DD` calendar date; invalid and future dates are rejected. The evaluation date is owned by the server and injected once per request; the request body never carries it. A request that supplies an evaluation date is rejected as invalid input rather than having the value ignored, so a caller cannot declare its own age. The injected date is returned as `evaluatedAt`, so the reported age can be reproduced. A February 29 birthday advances on March 1 in a non-leap year unless a jurisdiction-specific rule says otherwise. Operational timestamps use UTC ISO 8601.

Jurisdictions are trimmed and uppercased before matching, then checked against a jurisdiction code shape: two uppercase letters, optionally followed by a hyphen and a one-to-three-character uppercase alphanumeric subdivision (`US`, `US-CA`). A value that is empty after normalization or fails that shape is rejected as `validation_error`; it never falls through to the `*` rule. A well-formed jurisdiction that is absent from policy remains valid input: it follows the normal subdivision → country → `*` lookup and may legitimately match the wildcard rule or return `no_matching_policy`. Feature identifiers must exactly match `policy.features`; silently correcting an unknown feature could hide a client defect.

## Storage

The exercise selects an in-memory repository behind an interface. This supports the required stateful workflow without adding migrations and database operations to a small take-home. The trade-off is explicit: state resets after restart or redeployment, and there is no cross-instance consistency guarantee.

PostgreSQL is the production direction because consent requires uniqueness, transactions, conditional updates, and auditable history. Browser storage would put authoritative consent in the wrong trust boundary.

## API and UI

REST keeps the small command-oriented workflow explicit. `POST /decisions` carries structured input without placing DOB in a URL. GraphQL would add schema and resolver machinery without solving a query-shape problem in this exercise.

Policy decisions remain on the server. The page will receive a display-safe policy model plus the server's `lookupPath` and `matchedRule`; it will not reconstruct precedence. Demo presets will generate fresh subjects so prior consent cannot change the advertised starting result.

## Verification

Policy and age rules will be tested as pure units, consent behavior through services and the real in-memory repository, HTTP mapping at route boundaries, and a few critical journeys in Playwright. Each demo preset will also be evaluated against the real engine so presentation metadata cannot drift from behavior.

## Open production questions

- When does consent expire, and which policy changes require re-consent?
- Can consent cross jurisdictions, products, purposes, or guardian relationships?
- Should a coverage gap use a fourth production outcome rather than exercise-compatible `blocked`?
- How should multiple guardians' conflicting decisions be resolved?
