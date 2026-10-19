# Consent Gate

A policy-driven access decision service with a parental-consent workflow.

Given a subject's date of birth, jurisdiction, and requested feature, the service returns `allowed`, `blocked`, or `parental_consent`. When policy permits consent, a parent can approve, decline, or later reverse the current decision.

> **Current state:** all three implementation milestones are delivered: the domain core, the services and `/api/v1` routes, and the single-page consent workflow. `npm run verify` runs 168 Vitest tests, a production build, and 14 Playwright journeys; coverage is 98.5% statements and 95.06% branches. The public deployment URL is pending.

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
npm run test:run       # 168 Vitest tests
npm run build          # production build of the page and the three /api/v1 route files (four operations)
npm run test:e2e       # 14 Playwright journeys (run npm run build first)
npm run verify         # coverage -> build -> E2E, the same stages CI runs
```

No suite may pass vacuously: the starter's empty-suite allowances were removed in the final pass, so a missing or empty suite fails the command.

### Developer checks

These are reproducible supporting checks, not part of `npm run verify`:

```bash
bash tools/http-smoke.sh         # real HTTP smoke on port 3200 (run npm run build first)
bash tools/mutation-check-m1.sh  # domain safety-rule mutations
bash tools/mutation-check-m2.sh  # service/HTTP mutations
bash tools/mutation-check-m3.sh  # UI mutations (rebuilds and runs Playwright)
```

## Deployment

GitHub Actions verifies a pushed revision before asking Render to deploy that commit. Render uses `/` as its service health check. Auto-deploy is disabled so the same push is not deployed twice.

Required GitHub configuration:

- secrets: `RENDER_API_KEY`, `RENDER_SERVICE_ID`;
- variable: `RENDER_SERVICE_URL`;
- environment: `production`.

In-memory consent resets after restart, redeployment, or service sleep.

**Live application:** pending deployment of the reviewed commit.

## Known limitations

- State is in memory: it resets on restart, redeploy, or service sleep, and is not shared across instances.
- Authentication and guardian verification are out of scope; the parent panel uses a trusted demo identity.
- There is no immutable audit history, policy administration, expiry, or re-consent flow.
- The policy is one JSON file shipped with the application; invalid or duplicate rules fail startup.
- Demo presets derive their date of birth from the server's evaluation date, so the advertised outcome does not drift as the calendar advances.
- The public deployment URL is not yet verified.

## Submission check

- [x] The complete child-to-parent journey works (14 Playwright journeys, including approve, decline, reversal, and the API error contract).
- [x] Empty-suite allowances are removed and `npm run verify` passes.
- [x] README capabilities match the delivered code.
- [ ] The reviewed commit is the deployed commit (pending push and Render deployment).
- [x] `DECISIONS.md` and `AI-USE.md` contain final, factual information.
- [x] Known limitations and unfinished work are explicit.
