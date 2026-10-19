# Decisions

The brief asks for a small service that decides what a user may do, based on age, jurisdiction, and parental consent, with rules aimed at under-18 use. It fixes the rules and the three outcomes but leaves the operating semantics open: who consent belongs to, which rule wins, what happens when no rule matches, and how a child is identified without accounts.

This file records the choices that affect behavior, the alternatives that were rejected, and what each choice costs. All decisions below are accepted and implemented. The resulting contracts are in [`docs/DESIGN.md`](docs/DESIGN.md); deferred production design is in [`docs/PRODUCTION_NOTES.md`](docs/PRODUCTION_NOTES.md).

## Goals and non-goals

The service must be deterministic, server-owned, and explainable: every answer carries a stable reason, lookup path, and matched rule. It must support a reversible parental-consent lifecycle without letting consent override a hard block.

It is not a production identity or consent platform. Authentication, guardian verification, durable storage, audit history, policy administration, notifications, and multi-region operation are out of scope; the demo uses a trusted parent view and in-memory state.

## 1. Consent belongs to a subject and a scope

**Context.** Two children can share a birthday, and one child can have different outcomes for chat, purchases, and profile photos. Date of birth is an attribute, not an identifier.

**Decision.** Consent is keyed by `subjectId + jurisdiction + feature`. The demo generates a synthetic subject id; a production product would derive it from an authenticated profile.

**Consequences.** The demo needs a subject id that is stable for the walkthrough but not a real identity. Production scope would likely add product, purpose, policy version, and expiry.

**Alternatives considered.** Keying by DOB would merge unrelated children. Keying by subject alone would let consent for one feature satisfy another. Keying by feature alone would let one child's approval satisfy another's.

## 2. The most specific rule wins

**Context.** The supplied policy contains global, country, and subdivision rules. JSON order is an implementation detail, not a precedence rule.

**Decision.** The evaluator checks the exact subdivision, then the country, then `*`, and selects the first rule found on that ladder. It never combines rules.

**Consequences.** Reordering the JSON cannot change a decision, and `US-CA` beats `US` and `*` deterministically. The model assumes a jurisdiction hierarchy can be derived by splitting the code; production should model inheritance explicitly.

**Alternatives considered.** First-match-in-file order makes behavior depend on authoring order. Merging all matching rules requires conflict semantics the brief does not define.

## 3. Access checks are read-only; asking a parent is the only write

**Context.** A decision check may run during a refresh, retry, prefetch, or background job. If it created state, a read could generate a request or notification that nobody asked for.

**Decision.** **Check access** is read-only. **Ask a parent** is the only operation that creates or reuses a consent request. Before creating one, the server re-evaluates the scenario and rejects an adult or a hard block as `consent_not_required`.

**Consequences.** The UI must offer an explicit action. The server, not the client, decides whether a request is eligible. The demo can refresh and retry without side effects.

**Alternatives considered.** Creating a request automatically whenever the decision is `parental_consent` produces state the user never requested. Client-side eligibility would duplicate policy logic and let the browser claim consent is available.

## 4. A hard block cannot be overridden; a missing rule fails closed

**Context.** Some rules block under-age use outright (`GB` chat, `US-TX` video upload, `DE` purchases). Other rules permit parental consent. A declared feature can also have no applicable rule at all.

**Decision.** Consent affects only a winning rule whose under-age action is `parental_consent`. It never overrides `blocked`, including when an older approval exists. An undeclared feature is invalid input; a declared feature with no applicable rule returns `blocked / no_matching_policy`.

**Consequences.** A stricter current rule can ignore an old approval; that is intentional. Operations should alert on `no_matching_policy` so a coverage gap is not mistaken for normal blocking, and the UI can distinguish the two.

**Alternatives considered.** Letting consent override any under-age rule would break the legal floor. Failing open on missing coverage would grant access wherever the policy has a gap. Treating an undeclared feature as a coverage gap would hide a client defect. A fourth production outcome (for example `unavailable`) is a reasonable future change but would break the brief's three-outcome contract.

## 5. Identity is synthetic in the demo, and state is in memory

**Context.** Accounts, guardian verification, and durable storage are outside the brief, which explicitly allows an in-memory implementation.

**Decision.** The demo generates a synthetic subject id and stores consent in an in-memory repository behind an interface. A parent can approve, decline, and reverse the current state.

**Consequences.** State resets on restart or redeploy and is not shared across instances. Production would move to PostgreSQL, because consent needs uniqueness, transactions, conditional updates, and auditable history. Browser storage would put authoritative consent in the wrong trust boundary.

**Alternatives considered.** Requiring real accounts would expand the scope beyond the exercise. Keeping state in the browser would make the client authoritative. Shipping without stored state would make reversal impossible to demonstrate. Adding PostgreSQL now would trade policy and workflow time for migration work.

## 6. The server owns dates and input normalization

**Context.** Age is an enforcement input, and a caller must not be able to declare its own age. Dates and jurisdiction codes arrive from users and need one canonical interpretation.

**Decision.** A DOB must be a real `YYYY-MM-DD` calendar date; invalid, implausible (before 1900), and future dates are rejected. February 29 advances to March 1 in a non-leap year. The evaluation date is owned by the server, injected once per request, and returned as `evaluatedAt`; a request that supplies its own date is rejected rather than silently ignored.

Jurisdictions are trimmed and uppercased, then checked against `^[A-Z]{2}(-[A-Z0-9]{1,3})?$`. A malformed value is a `validation_error` and never falls through to `*`; a well-formed but unknown jurisdiction stays valid and follows the normal lookup. Features must exactly match `policy.features`. Operational timestamps are stored and returned as UTC ISO 8601.

**Consequences.** Input is strict: clients receive errors instead of best-effort corrections. The reported age is reproducible, and a raw lowercase jurisdiction cannot bypass a hard block.

**Alternatives considered.** Accepting a client-supplied evaluation date would let the caller choose its age. Ignoring the field instead of rejecting it would leave ambiguous behavior. Permissive date parsing would accept values such as February 30. Correcting unknown feature names would hide a client defect.

## Deferred work

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
