# Decisions

The brief asks for a small service that decides what a user may do, based on age, jurisdiction, and parental consent, with rules aimed at under-18 use. It fixes the rules and the three outcomes but leaves the operating semantics open: who consent belongs to, which rule wins, what happens when no rule matches, how a child is identified without accounts, and what happens when a parent changes their mind.

This file covers the choices that affect behavior, the alternatives rejected, and what each costs. All are accepted and implemented. Contracts and diagrams (architecture, rule lookup, consent state machine, request sequence) are in [`docs/DESIGN.md`](docs/DESIGN.md); deferred production design is in [`docs/PRODUCTION_NOTES.md`](docs/PRODUCTION_NOTES.md).

## Goals and non-goals

**Goals.** The service must be deterministic, server-owned, and explainable: every answer carries a stable reason, lookup path, and matched rule. It must support a reversible parental-consent lifecycle without letting consent override a hard block. The answer is recomputed from current state on every request; there is no cached decision to invalidate.

**Non-goals.** It is not a production identity or consent platform. Authentication, guardian verification, object-level authorization, durable storage, audit history, policy administration, notifications, and multi-region operation are out of scope. The demo models the consent state machine, not verified legal consent: it trusts the supplied subject id and a trusted parent view, and keeps state in memory.

## Decisions

Decisions 1 to 5 define policy and consent semantics. Decisions 6 to 8 define the demo's trust, record, and input boundaries.

### 1. Consent belongs to a subject and a scope

Two children can share a birthday, and one child can have different outcomes for chat, purchases, and profile photos. Date of birth is an attribute, not an identifier.

> **Consent is keyed by `subjectId + jurisdiction + feature`.** The demo generates a synthetic subject id; a production product would derive it from an authenticated profile.

This keeps consent from leaking across children, features, or jurisdictions.

A consent granted in `DE` does not apply in `GB`; the child needs a new decision, and where the new rule permits it, a new approval. The cost is a synthetic subject id in the demo; production scope would add product, purpose, policy version, and expiry.

**Alternatives considered**

- **Date of birth as the key**: would merge unrelated children who share a birthday.
- **Subject only**: consent for one feature or jurisdiction would satisfy another.
- **Feature only**: one child's approval would satisfy another's.

### 2. The most specific rule wins

The supplied policy contains global, country, and subdivision rules. JSON order is an implementation detail, not a precedence rule.

> **Specificity decides, not file order.** The evaluator checks the exact subdivision, then the country, then `*`, and selects the rule at the first level that has one; it never combines rules.

Reordering the JSON cannot change a decision, and `US-CA` beats `US` and `*` deterministically.

The policy is loaded once at startup, validated, and frozen: duplicate features, duplicate rules for the same jurisdiction and feature, and rules for undeclared features stop startup. The model assumes a jurisdiction hierarchy can be derived by splitting the code; production should model inheritance explicitly.

**Alternatives considered**

- **First match in file order**: makes behavior depend on how the JSON happens to be ordered.
- **Merge every matching rule**: needs conflict semantics the brief does not define.
- **Validate the policy on each request**: a malformed file would surface as a per-request error instead of stopping startup.

### 3. Access checks are read-only; asking a parent is the only write

A decision check may run during a refresh, retry, prefetch, or background job. If it created state, a read could generate a request or notification that nobody asked for.

> **Check access never writes; asking a parent is the only operation that can create consent state.** Before creating a request, the server re-evaluates the scenario and rejects an adult or a hard block as `consent_not_required`.

The UI must offer an explicit action, but refresh and retry stay side-effect free. The server, not the client, decides whether a request is eligible. Because the check is read-only, the answer is recomputed from the current policy, date of birth, and consent state on every request; no decision is cached.

The result is a check for this request, not a token or a grant: every protected action must call the service server-side, and a caller that caches `allowed` past a consent or policy change is outside the contract.

**Alternatives considered**

- **Create automatically on `parental_consent`**: would produce state the user never requested.
- **Let the client decide eligibility**: would duplicate policy logic and let the browser claim consent is available.

### 4. A scope has at most one request, and the latest parent decision wins

A parent can retry, double-click, or return after approving. The brief also requires them to change their mind. Without one rule, a retry can reset an approval or create a second history.

> **One request per `subjectId + jurisdiction + feature`.** Asking again returns the existing record unchanged; the server looks up the scope before evaluating eligibility, so an approved or declined request is never reset to `pending`.

> **Parent decisions are reversible and idempotent.** Approve and decline update the same record; repeating the current state is a no-op, and either state can be reversed later.

For an under-age user whose winning rule permits consent, the decision follows the latest state: pending is `parental_consent / parental_consent_pending`, approved is `allowed / parental_consent_approved`, and declined is `blocked / parental_consent_declined`. A decline is not the same as no request, and a reversal is visible on the next evaluation.

An existing record is returned even when the current rule would no longer permit creating a new one; the attached decision still uses the current rule, so it may be `blocked` or `allowed`.

The record keeps `createdAt` and updates `updatedAt`; it does not keep a history of decisions, so production needs an audit trail. Stored requests are not rewritten when the child's age or the policy changes; production needs expiry and cleanup.

**Alternatives considered**

- **Create a new request per ask**: duplicates the scope and can reset a decision on retry.
- **Treat a decline as terminal**: contradicts the brief's requirement to change their mind.
- **Reject a repeated approve or decline**: makes retries fragile; the same action should be safe to repeat.

### 5. A hard block cannot be overridden; a missing rule fails closed

Some rules block under-age use outright (`GB` chat, `US-TX` video upload, `DE` purchases). Other rules permit parental consent. A declared feature can also have no applicable rule at all.

> **Consent applies only where the winning rule permits it.** It never overrides `blocked`, even when an older approval exists. An undeclared feature is invalid input; a declared feature with no applicable rule returns `blocked / no_matching_policy`.

This prevents a policy gap from silently granting access and stops consent from weakening a legal block. The trade-off is that a stricter current rule can ignore an old approval; operations should alert on `no_matching_policy` so a gap is not mistaken for normal blocking.

The supplied rules have real gaps: `video_upload` has only a `US-TX` rule, and `purchases` has no `*` rule, so `US + video_upload` and `FR + purchases` both return `no_matching_policy` for every age, including adults.

**Alternatives considered**

- **Let consent override any under-age rule**: breaks the legal floor.
- **Fail open on missing coverage**: grants access wherever the policy has a gap.
- **Treat an undeclared feature as a coverage gap**: hides a client defect.
- **Add a fourth outcome**: reasonable in production, but breaks the brief's three-outcome contract.

### 6. Identity is synthetic, and state is in memory

Accounts, guardian verification, and durable storage are outside the brief, which explicitly allows an in-memory implementation. The demo also trusts the subject id supplied by the caller.

> **The demo generates a subject id and keeps consent in memory.** A parent can approve, decline, and reverse the current state; the repository sits behind an interface so production can replace it.

The workflow runs with no infrastructure. The trade-off is that state resets on restart or redeploy and is not shared across instances.

The demo is a single process, so a parent action is visible to the next check. Production needs a transactional read path with the same read-your-writes guarantee; a replica read that lags behind an approval would decide from stale state. It also needs uniqueness, conditional updates, and audit history in the store.

The demo does not authenticate the caller: any client can supply any `subjectId`. It also does not establish a guardian-subject relationship or record evidence that the person acting is the guardian; the parent view is trusted.

Authentication, guardian verification, and object-level authorization are out of scope. Production would authenticate the caller, link guardians to subjects, and record approval-time evidence, so a parent action can be attributed.

**Alternatives considered**

- **Require real accounts**: expands the scope beyond the exercise.
- **Keep state in the browser**: makes the client authoritative.
- **Ship without stored state**: makes reversal impossible to demonstrate.
- **Add PostgreSQL now**: trades policy and workflow time for migration work.

### 7. A consent record stores state, not a frozen decision

A parent approval records a decision, but it is not the decision itself. Age, the matched rule, and the policy version can all change after approval.

> **The consent record stores state, not a frozen decision.** It holds subject, jurisdiction, feature, status, and timestamps; age, matched rule, and policy version are recomputed at read time, not stored.

The parent panel shows the current evaluation, not the approval-time evidence. Production should store the date of birth, matched rule, and policy version at approval time so a later policy change can be explained.

The record therefore holds no date of birth. Production also needs retention, deletion, and access rules for children's data.

**Alternatives considered**

- **Freeze the decision into the record**: would keep returning an outcome the current policy no longer produces.
- **Copy the date of birth into every consent record**: duplicates a child's personal data and makes deletion ambiguous.

### 8. The server owns the clock, the age boundary, and input normalization

Age is an enforcement input, but the demo has no verified profile: the request supplies the date of birth, so a caller can lie about it. Production would verify the date of birth once and store it with the profile, so a later request cannot choose a different age. What the server can own in the demo is the clock and one canonical interpretation of the values it receives.

> **The server owns the evaluation date and the age boundary; the request supplies the date of birth.** A client-supplied evaluation date is rejected. Age is whole years on the evaluation date: a user is allowed from their `min_age` birthday (`age >= min_age`), and `if_under` applies only below it.

February 29 is treated as March 1 in a non-leap year. A date of birth must be a real `YYYY-MM-DD` date; invalid, future, or implausible dates (before 1900) are rejected. The evaluation date is injected once per request and returned as `evaluatedAt`.

Age is checked before consent, so once the child reaches `min_age` the decision is `allowed / meets_minimum_age` even if an earlier request was declined. The 1900 floor exists because a birth year of 0000 or 1800 would satisfy every threshold; it is a plausibility bound, not a legal rule. Age is evaluated on the server's UTC calendar date; the exercise carries no jurisdiction timezone data, so production should use the subject's local date.

> **Input is normalized once, at the server boundary.** Jurisdictions are trimmed and uppercased, then checked against `^[A-Z]{2}(-[A-Z0-9]{1,3})?$`. A malformed value is a `validation_error` and never falls through to `*`; a well-formed but unknown code continues down the ladder, matching a `*` rule if one exists and otherwise returning `no_matching_policy`. Features must exactly match `policy.features`.

Normalization is limited to whitespace and case; shape errors are rejected rather than corrected. The reported age is reproducible, and a raw lowercase jurisdiction cannot bypass a hard block.

`createdAt` and `updatedAt` are UTC ISO 8601 timestamps; `evaluatedAt` is a UTC calendar date. Request bodies are capped at 8 KiB and `subjectId` at 128 characters, so one public request cannot exhaust the in-memory store.

**Alternatives considered**

- **Accept a client-supplied evaluation date**: would let the caller choose its age.
- **Ignore the field instead of rejecting it**: would leave ambiguous behavior.
- **Parse dates permissively**: would accept values such as February 30.
- **Correct unknown feature names**: would hide a client defect.
- **Trust a client-supplied age instead of a date of birth**: removes the calendar interpretation but not the spoofing; a date of birth at least gives one canonical calculation.
- **Reject unknown well-formed jurisdictions**: would turn a coverage question into a validation error and make adding a country a breaking API change.

## Skipped for time and out of scope

The brief allows in-memory storage and does not ask for an identity system. Two different lists matter.

**Out of scope for the exercise**

- Durable storage, migrations, cross-instance consistency, and concurrency control for opposing writes.
- Authentication, guardian verification, and object-level authorization. The parent panel is a trusted demo view.
- Multi-region operation.

**Not built, in rough priority order**

- Rate limiting and abuse controls on decision checks and request creation.
- An audit trail for consent changes. The record keeps only the latest state.
- Consent expiry, re-consent after a policy change, and approval-time evidence. The product rule is still open below.
- Policy administration and notifications.
- Localization and jurisdiction data beyond the supplied rules.
- Retention, deletion, and access controls for children's data.

## Open product questions

These need a product or legal owner. They are not implementation gaps.

- When does consent expire, and which policy changes require re-consent?
- Can consent cross jurisdictions, products, purposes, or guardian relationships?
- Should a coverage gap use a fourth production outcome rather than exercise-compatible `blocked`?
- How should multiple guardians' conflicting decisions be resolved?
- What age assurance is required, and how is a guardian linked to a subject and verified?
- What evidence must be kept at approval time so a later decision can be defended?
- Who owns the jurisdiction mapping and its effective dates, and what review is required before a rule changes?
- How long is consent evidence retained, where may it be stored, and what is the deletion path for a child or guardian?
