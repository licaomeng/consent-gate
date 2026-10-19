# Decisions

The brief leaves several behaviors open. This file records each interpretation that changes behavior, why it was chosen, and what it costs. The resulting contracts live in [`docs/DESIGN.md`](docs/DESIGN.md); deferred production design lives in [`docs/PRODUCTION_NOTES.md`](docs/PRODUCTION_NOTES.md).

## At a glance

| Area | Decision | Why | Cost |
|---|---|---|---|
| Consent scope | Key consent by `subjectId + jurisdiction + feature` | Consent must not leak across children, features, or jurisdictions | Requires a synthetic subject id in the demo |
| Rule resolution | Exact subdivision → country → `*`; file order never wins | Deterministic specificity, matching the supplied `US-CA` and `US-TX` rules | Assumes the hierarchy is derivable by splitting the code |
| Read/write boundary | Checks are read-only; **Ask a parent** is the only write | Retries and refreshes must not create requests | The product needs an explicit consent action |
| Hard blocks | Consent never overrides `blocked` | The hard block is the legal floor | An old approval can be superseded by a stricter rule |
| Coverage gaps | Fail closed as `blocked / no_matching_policy` | A missing rule must not grant access | The UI must distinguish a gap from an explicit prohibition |
| Consent lifecycle | One reversible current state per scope | Supports approve, decline, and change of mind without event sourcing | No immutable audit history |
| Storage | In-memory repository behind an interface | The brief allows it; keeps focus on semantics | State is not durable or shared across instances |
| Policy source | Rules load from `src/data/policy.json` and fail startup if invalid | The brief requires data, not baked-in logic | A policy change requires a redeploy |
| Dates | Server-owned evaluation date; strict calendar validation | Age is security-relevant and must not be client-declared | Malformed input is rejected; case and whitespace are normalized |
| API and UI | REST; policy stays server-side; the page renders evidence | Keeps one enforcement point and prevents rule drift | The UI depends on server-supplied `lookupPath` and `matchedRule` |

## Consent scope

**Decision.** Consent is keyed by `subjectId + jurisdiction + feature`. Date of birth is an attribute, not an identifier.

**Why.** Two children can share a birthday, and one child can have different consent outcomes for different features or jurisdictions. Keying by DOB would merge unrelated people.

**Cost.** The demo needs a synthetic `subjectId` because accounts are out of scope; a production product would derive the subject and guardian relationship from authenticated profiles. A production scope would also likely include product, purpose, policy version, and expiry.

## Rule resolution

**Decision.** The evaluator checks the exact subdivision, then the country, then the global `*` rule. File order never determines the winner. Multiple matching rules are not combined.

**Why.** Specificity is deterministic and fits the supplied `US-CA` and `US-TX` data. Combining rules would require conflict semantics the brief does not define.

**Cost.** This assumes a jurisdiction hierarchy can be derived by splitting the code. A production policy should model inheritance explicitly.

## Read and write boundary

**Decision.** **Check access** is read-only. **Ask a parent** is the explicit operation that creates or reuses a request.

**Why.** Decision checks may run during refresh, retry, prefetch, or background work. Allowing them to create state could generate unintended requests or notifications.

**Cost.** The UI must offer a separate action. The server re-evaluates the scenario before creating a request, so a client cannot claim consent is available for an already allowed feature or a hard block.

## Consent lifecycle and idempotency

**Decision.** One mutable record represents the current state for a scope. It starts as `pending`, can become `approved` or `declined`, and can move between resolved states when a parent changes their mind.

**Decision.** Creating an existing scope returns the record before new-request eligibility is evaluated. Repeating the current target state is also harmless.

**Why.** Idempotent retries without event sourcing; change of mind stays one update.

**Cost.** Simultaneous opposing writes are not solved. Production would add a unique scope constraint, a version check such as `If-Match`, and immutable audit events.

## Hard blocks

**Decision.** Consent affects only a winning rule whose under-age action is `parental_consent`. It never overrides `blocked`, including when an older approval exists.

**Why.** The hard block is the legal floor.

**Cost.** A stricter current rule can ignore an old approval.

## Coverage gaps and invalid features

**Decision.** An undeclared feature is invalid input. A declared feature with no applicable rule fails closed as `blocked / no_matching_policy`.

**Why.** A missing rule must not grant access, but failing closed should be distinguishable from an explicit prohibition.

**Cost.** Operations must alert on `no_matching_policy` so a coverage gap is not mistaken for normal blocking.

## Dates and input normalization

**Decision.** A DOB must be a real `YYYY-MM-DD` calendar date. Invalid, implausible, and future dates are rejected. Dates before 1900 are implausible because a nonsensical value such as `0000-01-01` would satisfy every threshold.

**Decision.** A February 29 birthday advances on March 1 in a non-leap year unless a jurisdiction-specific rule says otherwise.

**Decision.** The evaluation date is owned by the server, injected once per request, and returned as `evaluatedAt`. A client-supplied evaluation date is rejected rather than ignored, so a caller cannot declare its own age.

**Decision.** Jurisdictions are trimmed and uppercased, then checked against `^[A-Z]{2}(-[A-Z0-9]{1,3})?$`. A malformed value is a `validation_error` and never falls through to `*`. A well-formed but unknown jurisdiction stays valid input and follows the normal lookup.

**Decision.** A feature must exactly match `policy.features`; the server does not silently correct it.

**Decision.** Operational timestamps (`createdAt`, `updatedAt`) are stored and returned as UTC ISO 8601.

**Why.** Age and scope are enforcement inputs. Rejecting bad input exposes client defects instead of hiding them, and a server-owned evaluation date makes the reported age reproducible.

**Cost.** Input is strict: clients receive errors instead of best-effort corrections.

## Storage

**Decision.** The exercise uses an in-memory repository behind an interface.

**Why.** It supports the required stateful workflow without adding migrations and database operations to a small take-home.

**Cost.** State resets after restart or redeployment, and there is no cross-instance consistency guarantee.

**Production direction.** PostgreSQL, because consent needs uniqueness, transactions, conditional updates, and auditable history. Browser storage would put authoritative consent in the wrong trust boundary.

## API and UI

**Decision.** The API is REST. `POST /api/v1/decisions` carries structured input so the DOB stays out of URLs.

**Decision.** Policy evaluation stays on the server. The page receives a display-safe policy model plus the server's `lookupPath`, `matchedRule`, and reason; it never recomputes precedence.

**Decision.** Demo presets generate a fresh subject and carry an age rather than a fixed DOB. The page derives the DOB from the server's evaluation date.

**Why.** REST keeps a small command workflow explicit. Server-side evaluation prevents browser and server rules from drifting. Age-based presets keep the advertised outcome aligned with the engine as the calendar advances.

**Cost.** GraphQL would add schema and resolver machinery without solving a query-shape problem here. Preset metadata remains presentation-only and must be checked by a contract test.

## Policy source

**Decision.** All rules come from `src/data/policy.json`. The policy is validated at startup; invalid rules, duplicate features, duplicate scope keys, undeclared features, and invalid jurisdictions stop the process.

**Why.** The brief requires the rules to be data rather than baked into routes or UI. Failing at startup is safer than serving with a partially valid policy.

**Cost.** The policy cannot be changed at runtime, and a new rule set requires a redeploy. Policy administration and versioning are out of scope.

## Verification

Policy and age rules are tested as pure units. Consent behavior is tested through services and the real in-memory repository. HTTP mapping is tested at the route boundary, and critical journeys run in Playwright. Each demo preset is evaluated against the real engine so presentation metadata cannot drift. Safety rules also have mutation checks: removing a guard must turn at least one test red.

## Skipped for time

The exercise permits an in-memory implementation. Deliberate omissions:

- Durable storage, migrations, cross-instance consistency, and concurrency control for opposing writes.
- Authentication, guardian verification, and authorization. The parent panel uses a trusted demo identity.
- Immutable audit history, policy administration, consent expiry, and re-consent.
- Rate limiting and abuse controls on the consent lookup endpoints.
- Localization and jurisdiction data beyond the supplied rule set.

## Open production questions

- When does consent expire, and which policy changes require re-consent?
- Can consent cross jurisdictions, products, purposes, or guardian relationships?
- Should a coverage gap use a fourth production outcome rather than exercise-compatible `blocked`?
- How should multiple guardians' conflicting decisions be resolved?
