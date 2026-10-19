# Decisions

The brief asks for a small service that decides what a user may do, based on age, jurisdiction, and parental consent, with rules aimed at under-18 use. It fixes the rules and the three outcomes but leaves the operating semantics open: who consent belongs to, which rule wins, what happens when no rule matches, and how a child is identified without accounts.

This file covers the choices that affect behavior, the alternatives rejected, and what each costs. All are accepted and implemented. Contracts and diagrams (architecture, rule lookup, consent state machine, request sequence) are in [`docs/DESIGN.md`](docs/DESIGN.md); deferred production design is in [`docs/PRODUCTION_NOTES.md`](docs/PRODUCTION_NOTES.md).

## Goals and non-goals

**Goals.** The service must be deterministic, server-owned, and explainable: every answer carries a stable reason, lookup path, and matched rule. It must support a reversible parental-consent lifecycle without letting consent override a hard block.

**Non-goals.** It is not a production identity or consent platform. Authentication, guardian verification, durable storage, audit history, policy administration, notifications, and multi-region operation are out of scope; the demo uses a trusted parent view and in-memory state.

## Decisions

### 1. Consent belongs to a subject and a scope

Two children can share a birthday, and one child can have different outcomes for chat, purchases, and profile photos. Date of birth is an attribute, not an identifier.

> **Consent is keyed by `subjectId + jurisdiction + feature`.** The demo generates a synthetic subject id; a production product would derive it from an authenticated profile.

This keeps consent from leaking across children, features, or jurisdictions. The cost is a synthetic subject id in the demo; production scope would add product, purpose, policy version, and expiry.

**Alternatives considered**

- **DOB as the key**: would merge unrelated children who share a birthday.
- **Subject only**: consent for one feature would satisfy another.
- **Feature only**: one child's approval would satisfy another's.

### 2. The most specific rule wins

The supplied policy contains global, country, and subdivision rules. JSON order is an implementation detail, not a precedence rule.

> **Specificity decides, not file order.** The evaluator checks the exact subdivision, then the country, then `*`, and selects the first rule found on that ladder; it never combines rules.

Reordering the JSON cannot change a decision, and `US-CA` beats `US` and `*` deterministically. The model assumes a jurisdiction hierarchy can be derived by splitting the code; production should model inheritance explicitly.

**Alternatives considered**

- **First match in file order**: makes behavior depend on how the JSON happens to be ordered.
- **Merge every matching rule**: needs conflict semantics the brief does not define.

### 3. Access checks are read-only; asking a parent is the only write

A decision check may run during a refresh, retry, prefetch, or background job. If it created state, a read could generate a request or notification that nobody asked for.

> **Check access never writes; asking a parent creates or reuses the request.** Before creating one, the server re-evaluates the scenario and rejects an adult or a hard block as `consent_not_required`.

The UI must offer an explicit action, but refresh and retry stay side-effect free. The server, not the client, decides whether a request is eligible.

**Alternatives considered**

- **Create automatically on `parental_consent`**: would produce state the user never requested.
- **Let the client decide eligibility**: would duplicate policy logic and let the browser claim consent is available.

### 4. A hard block cannot be overridden; a missing rule fails closed

Some rules block under-age use outright (`GB` chat, `US-TX` video upload, `DE` purchases). Other rules permit parental consent. A declared feature can also have no applicable rule at all.

> **Consent applies only where the winning rule permits it.** It never overrides `blocked`, even when an older approval exists. An undeclared feature is invalid input; a declared feature with no applicable rule returns `blocked / no_matching_policy`.

This prevents a policy gap from silently granting access and stops consent from weakening a legal block. The trade-off is that a stricter current rule can ignore an old approval; operations should alert on `no_matching_policy` so a gap is not mistaken for normal blocking.

**Alternatives considered**

- **Let consent override any under-age rule**: breaks the legal floor.
- **Fail open on missing coverage**: grants access wherever the policy has a gap.
- **Treat an undeclared feature as a coverage gap**: hides a client defect.
- **Add a fourth outcome**: reasonable in production, but breaks the brief's three-outcome contract.

### 5. Identity is synthetic in the demo, and state is in memory

Accounts, guardian verification, and durable storage are outside the brief, which explicitly allows an in-memory implementation.

> **The demo generates a subject id and keeps consent in memory.** A parent can approve, decline, and reverse the current state; the repository sits behind an interface so production can replace it.

The workflow runs with no infrastructure. The trade-off is that state resets on restart or redeploy and is not shared across instances. Production would move to PostgreSQL, because consent needs uniqueness, transactions, conditional updates, and auditable history; browser storage would put authoritative consent in the wrong trust boundary.

The exercise does not snapshot the age, matched rule, or policy version into the consent record; the parent panel shows the current evaluation. Production should store the approval-time evidence so a later policy change can be explained.

**Alternatives considered**

- **Require real accounts**: expands the scope beyond the exercise.
- **Keep state in the browser**: makes the client authoritative.
- **Ship without stored state**: makes reversal impossible to demonstrate.
- **Add PostgreSQL now**: trades policy and workflow time for migration work.

### 6. The server owns dates and input normalization

Age is an enforcement input, and a caller must not be able to declare its own age. Dates and jurisdiction codes arrive from users and need one canonical interpretation.

> **The server owns the evaluation date and rejects a client-supplied one.** A DOB must be a real `YYYY-MM-DD` calendar date; invalid, implausible (before 1900), and future dates are rejected. February 29 advances to March 1 in a non-leap year. The evaluation date is injected once per request and returned as `evaluatedAt`. Age is evaluated on the server's UTC calendar date; the exercise carries no jurisdiction timezone data, so production should use the subject's local date.

> **Input is normalized once, at the server boundary.** Jurisdictions are trimmed and uppercased, then checked against `^[A-Z]{2}(-[A-Z0-9]{1,3})?$`. A malformed value is a `validation_error` and never falls through to `*`; a well-formed but unknown jurisdiction follows the normal lookup. Features must exactly match `policy.features`. Operational timestamps are stored and returned as UTC ISO 8601.

Input is strict: clients receive errors instead of best-effort corrections. The reported age is reproducible, and a raw lowercase jurisdiction cannot bypass a hard block.

**Alternatives considered**

- **Accept a client-supplied evaluation date**: would let the caller choose its age.
- **Ignore the field instead of rejecting it**: would leave ambiguous behavior.
- **Parse dates permissively**: would accept values such as February 30.
- **Correct unknown feature names**: would hide a client defect.

## Deferred work

The exercise permits an in-memory implementation. Deliberate omissions:

- Durable storage, migrations, cross-instance consistency, and concurrency control for opposing writes.
- Authentication, guardian verification, and authorization. The parent panel uses a trusted demo identity.
- Immutable audit history, policy administration, consent expiry, and re-consent.
- Rate limiting and abuse controls on the consent lookup endpoints.
- Localization and jurisdiction data beyond the supplied rule set.

## Open product questions

These need a product or legal owner. They are not implementation gaps.

- When does consent expire, and which policy changes require re-consent?
- Can consent cross jurisdictions, products, purposes, or guardian relationships?
- Should a coverage gap use a fourth production outcome rather than exercise-compatible `blocked`?
- How should multiple guardians' conflicting decisions be resolved?
