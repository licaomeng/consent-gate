# Consent Gate — Original Exercise Brief

This is a normalized copy of the supplied live-coding exercise. Requirements and policy data are unchanged.

## Timebox

Give the exercise about one hour. The scope is intentionally larger than the time available. Explain assumptions, unfinished work, and what would be done next.

## What to build

Build a decision service that accepts date of birth, jurisdiction, and feature and returns `allowed`, `blocked`, or `parental_consent`. When consent is needed, raise a request and allow a parent to approve, decline, and later change the decision.

Build one page to enter inputs, see the result, raise a consent request, and act on it as the parent.

Use any familiar stack. The k-ID stack includes Go, TypeScript, React, Next.js, and Postgres. In-memory storage is acceptable.

## Supplied policy

The application must read rules from `src/data/policy.json` rather than bake them into code.

## Supplied examples

- Born `2015-03-01`, in `DE`, requesting `chat` → `parental_consent`.
- Born `1990-06-15`, in `US`, requesting `purchases` → `allowed`.

Where the brief or rules do not cover a case, make a decision and document it.

## Expected deliverables

1. Decision endpoint.
2. Consent requests a parent can approve, decline, and later change.
3. Correct and stable answers.
4. A few high-value tests.
5. `DECISIONS.md` for assumptions, choices, reasons, and skipped work.
6. A short `AI-USE.md`.
7. Run instructions in `README.md`.

AI tools are allowed. Record what was used, where it was wrong, and what was discarded. The candidate must understand and defend the submitted code.
