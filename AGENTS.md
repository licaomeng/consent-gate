# Agent Collaboration Rules

## Primary-agent ownership

The primary agent owns task planning, shared contracts, integration decisions, documentation consistency, and final verification. It is the only writer at dependency join points.

Before changing code, read:

1. `docs/EXERCISE_BRIEF.md`: supplied requirements; do not edit them.
2. `DECISIONS.md`: selected interpretations and trade-offs.
3. `docs/DESIGN.md`: intended architecture, behavior, and evidence.
4. `CLAUDE.md`: project-level engineering constraints.

## Delegation boundary

Delegate only work that is independent, has a clear scope, relies on stable contracts, and can be reviewed before integration.

Good uses of independent agents include:

- deriving adversarial cases from the brief and invariants;
- reviewing policy specificity, age boundaries, or consent safety;
- checking an API contract against the service behavior;
- checking documentation against the verified implementation.

Do not use parallel writers for shared domain contracts, service composition, dependent API/UI work, or final integration fixes. When parallel writing is justified, assign disjoint files and rejoin through the primary agent.

## Review protocol

A read-only reviewer must:

1. derive expected behavior from the brief, decisions, and design before reading the implementation;
2. report evidence-backed gaps rather than stylistic preferences;
3. avoid modifying files unless explicitly reassigned as a writer.

For each accepted defect, the primary agent reproduces it with a failing test, makes the smallest correction, and reruns the relevant regression tests. Sub-agent output is advisory until the primary agent and human owner review it.

## Working protocol

- Group work into reviewable changes and do not silently expand the scope.
- Derive tests from requirements and invariants, not only from generated code.
- After each material change, run focused verification and inspect the diff.
- Keep commit boundaries aligned with meaningful capabilities or corrections.
- Update `DECISIONS.md` when a selected design changes, including the reason.
- Update `AI-USE.md` only with material events that actually occurred.
- Keep commit hashes, verification results, and deployed-revision claims factual.

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

- `.github/workflows/ci.yml` controls CI.
- `render.yaml` defines the Render service.
- Render builds with `npm ci && npm run build`, starts with `npm start`, and deploys after checks pass.
- Storage is in memory for this exercise. State resets after restart, redeployment, or service sleep.
- Do not add unplanned infrastructure, services, or dependencies without recording the design change first.

The human author owns the result. Compilation is not proof of business correctness; a milestone is complete only after diff review and focused verification.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
