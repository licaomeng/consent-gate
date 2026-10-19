# Consent Gate

A policy-driven access decision service with a parental-consent workflow.

Given a subject's date of birth, jurisdiction, and requested feature, the service returns `allowed`, `blocked`, or `parental_consent`. When policy permits consent, a parent can approve, decline, or later reverse the current decision.

> **Current state:** the repository contains the reviewed design, development scaffolding, the M1 domain core, and the M2 services and HTTP routes (116 tests). The demonstration page and E2E tests have not started. Replace this notice with verified capabilities before submission.

## At a glance

- **Core path:** evaluate access → raise a request → parent acts → evaluate again.
- **Safety boundary:** consent may satisfy a consent-eligible rule, but it never overrides a hard block.
- **Source of truth:** the server validates and evaluates the supplied JSON policy; the browser displays the result and its evidence.
- **Exercise cut line:** one Next.js deployment and an in-memory repository. Durable identity, storage, audit, and concurrency are documented but not claimed.

## Review path

Start with [`DECISIONS.md`](DECISIONS.md), as requested in the exercise. It records the interpretations and trade-offs that affect behavior.

Then use:

- [`docs/DESIGN.md`](docs/DESIGN.md) for architecture, API, UI, and verification contracts;
- [`AI-USE.md`](AI-USE.md) for the factual AI contribution and correction log;
- [`docs/PRODUCTION_NOTES.md`](docs/PRODUCTION_NOTES.md) only for deferred production concerns;
- [`docs/EXERCISE_BRIEF.md`](docs/EXERCISE_BRIEF.md) for the original prompt.

## Run locally

Requires Node.js 20.9 or later.

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verify

```bash
npm run test:run
npm run build
npm run test:e2e
npm run verify
```

The starter temporarily permits empty suites. Before submission, those allowances must be removed and `npm run verify` must run non-empty Vitest suites, a production build, and Playwright E2E tests.

## Deployment

GitHub Actions verifies a pushed revision before asking Render to deploy that commit. Render uses `/` as its service health check. Auto-deploy is disabled so the same push is not deployed twice.

Required GitHub configuration:

- secrets: `RENDER_API_KEY`, `RENDER_SERVICE_ID`;
- variable: `RENDER_SERVICE_URL`;
- environment: `production`.

In-memory consent resets after restart, redeployment, or service sleep.

**Live application:** add after the deployed revision has been verified.

## Submission check

- [ ] The complete child-to-parent journey works.
- [ ] Empty-suite allowances are removed and `npm run verify` passes.
- [ ] README capabilities match the delivered code.
- [ ] The reviewed commit is the deployed commit.
- [ ] `DECISIONS.md` and `AI-USE.md` contain final, factual information.
- [ ] Known limitations and unfinished work are explicit.
