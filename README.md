# Consent Gate

**Live demo:** [consent-gate.onrender.com](https://consent-gate.onrender.com/)

A policy-driven access decision service with a parental-consent workflow.

Given a subject id, date of birth, jurisdiction, and requested feature, the service returns `allowed`, `blocked`, or `parental_consent`. The demo generates the subject id; a production product would derive it from an authenticated profile. When policy permits consent, a parent can approve, decline, or later reverse the current decision.

> **Current state:** all milestones are delivered. `npm run verify` runs 172 Vitest tests, a production build, and 19 Playwright journeys.

## At a glance

- **Core path:** evaluate access → raise a request → parent acts → evaluate again.
- **Safety boundary:** consent may satisfy a consent-eligible rule, but it never overrides a hard block.
- **Source of truth:** the server validates and evaluates the exercise policy in [`src/data/policy.json`](src/data/policy.json); the browser displays the result and its evidence.
- **Scope:** one Next.js app and an in-memory store. Durable identity, storage, audit, and concurrency are documented, not claimed.

## Review path

Start with [`DECISIONS.md`](DECISIONS.md), as requested in the exercise. It records the interpretations and trade-offs that affect behavior.

Then read [`docs/DESIGN.md`](docs/DESIGN.md) for the contracts. The map below covers the rest.

## Repository map

| Path | Contents |
|---|---|
| [`src/domain/`](src/domain/) | Pure policy, age, decision, and consent rules; no framework or I/O |
| [`src/services/`](src/services/) | Decision and consent orchestration over the repository contract |
| [`src/repository/`](src/repository/) | In-memory consent store behind an interface |
| [`src/app/`](src/app/) | Next.js page, layout, and the `/api/v1` route handlers |
| [`src/components/`](src/components/) | Client UI: page controller, decision card, and help tooltip |
| [`src/data/policy.json`](src/data/policy.json) | The rule set from the brief; validated at startup |
| [`tests/`](tests/) | Vitest unit, service, API, and application tests |
| [`e2e/`](e2e/) | Playwright journeys against a production build |
| [`tools/`](tools/) | Reproducible HTTP smoke and mutation checks |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Architecture, API, UI, accessibility, and test contracts |
| [`docs/PRODUCTION_NOTES.md`](docs/PRODUCTION_NOTES.md) | Deferred production design: storage, concurrency, trust boundary |
| [`docs/EXERCISE_BRIEF.md`](docs/EXERCISE_BRIEF.md) | The original prompt, preserved unchanged |
| [`AGENTS.md`](AGENTS.md) | Agent collaboration contract: milestones, delegation, review protocol |
| [`CLAUDE.md`](CLAUDE.md) | Claude-specific project constraints and workflow |
| [`AI-USE.md`](AI-USE.md) | What AI produced, where it was wrong, and what was discarded |
| [`DECISIONS.md`](DECISIONS.md) | Open choices, rationale, trade-offs, and skipped work |

## Run locally

Requires Node.js 20.9 or later.

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verify

```bash
npm run test:run       # 172 Vitest tests
npm run build          # production build of the page and the three /api/v1 route files (four operations)
npx playwright install chromium   # once, before the browser journeys
npm run test:e2e       # 19 Playwright journeys (run npm run build first)
npm run verify         # coverage -> build -> E2E, the same stages CI runs
```

A missing or empty suite fails the command; there are no empty-suite allowances.

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

**Live application:** https://consent-gate.onrender.com/ on Render. Its in-memory state is shared by visitors to the same instance.

## Known limitations

- State is in memory: it resets on restart, redeploy, or service sleep, and is not shared across instances.
- Authentication and guardian verification are out of scope; the parent panel uses a trusted demo identity.
- There is no immutable audit history, policy administration, expiry, or re-consent flow.
