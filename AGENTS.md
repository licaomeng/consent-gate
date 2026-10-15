# Coding Agent Instructions

## Source of truth

Read these files before changing code:

1. `docs/EXERCISE_BRIEF.md` — immutable supplied requirements.
2. `INTERVIEW_SPEC.md` — proposed working contract; interviewer-confirmed changes take priority.
3. `DECISIONS.md` — accepted assumptions, pending choices, and deferred work.

## Working protocol

- Inspect first and propose the smallest verifiable milestone before editing.
- Work on one approved milestone at a time; do not expand scope without asking.
- Keep policy and age logic framework-independent.
- Keep rules in `src/data/policy.json`; do not duplicate them in routes or UI.
- Keep access evaluation side-effect free. Consent creation is a separate action.
- Consent must never override a hard policy block.
- After each material change, run focused tests, summarize the diff and uncertainty, then stop for candidate review.
- Derive tests from the specification and policy, not only from generated implementation.
- Update `DECISIONS.md` only after a decision is accepted.
- Update `AI-USE.md` only with events that actually occurred.

## Commands

```bash
npm ci
npm run dev
npm run test:run
npm run build
npm run test:e2e
npm run verify
```

## Deployment contract

- `.github/workflows/ci.yml` is the CI source of truth.
- `render.yaml` is the Render deployment source of truth.
- Render builds with `npm ci && npm run build`, starts with `npm start`, and deploys after checks pass.
- Storage is intentionally in memory unless an interviewer-approved decision changes it. State resets after restart, redeployment, or service sleep.
- Do not add PostgreSQL, secrets, services, dependencies, or deployment changes unless the agreed milestone requires them.

The candidate owns the result. Compilation is not proof of business correctness; a milestone is complete only after diff review and focused verification.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
