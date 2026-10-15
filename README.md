# Consent Gate

Live-coding starter for a policy decision service and parental-consent workflow.

## Start here

- [`docs/EXERCISE_BRIEF.md`](docs/EXERCISE_BRIEF.md) — supplied exercise.
- [`INTERVIEW_SPEC.md`](INTERVIEW_SPEC.md) — proposed contract to confirm before coding.
- [`DECISIONS.md`](DECISIONS.md) — accepted choices and deferred work.
- [`AI-USE.md`](AI-USE.md) — factual AI-assistance log for this session.

## Local development

Requirements: Node.js 20.9 or later and npm.

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification

```bash
npm run test:run
npm run build
npm run test:e2e
npm run verify
```

The repository begins without product tests. The test commands tolerate that empty starting state so the framework can be checked before business implementation. Add focused tests with each milestone; once product E2E tests exist, `npm run verify` becomes the final comprehensive gate.

## Deployment

GitHub Actions validates pushes and pull requests. On pushes to `master`, the
workflow then deploys the verified commit through the Render API and waits until
Render reports it as `live`. `render.yaml` defines the Render service:

```text
push -> GitHub Actions verify -> Render API deploy -> wait for live -> production
```

Before enabling the deployment job, configure these repository settings:

- Actions secrets: `RENDER_API_KEY` and `RENDER_SERVICE_ID`
- Actions variable: `RENDER_SERVICE_URL` (for example,
  `https://consent-gate.onrender.com`)
- GitHub environment: `production` (created automatically on the first run if
  it does not already exist)

Render auto-deploy is disabled in `render.yaml` because GitHub Actions owns the
deployment. Do not push this workflow until the two required secrets are set.

The planned exercise storage is in memory. State therefore resets after process restart, redeployment, or service sleep.

> Add the public URL only after the Render service has been created and verified.

## Current status

- Confirmed scope: pending interviewer review
- Implemented business milestones: none
- Implemented business logic, API, consent workflow, and product tests: none
- Starter verification: dependency installation and production build pass locally
- Deferred work: pending scope alignment

Do not claim a feature or test is complete until it has been implemented and verified.
