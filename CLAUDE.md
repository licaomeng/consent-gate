# Claude Code Instructions

Follow [`AGENTS.md`](AGENTS.md) as the repository-wide collaboration contract.

Read the sources listed in `AGENTS.md` before changing code. When they do not resolve a product decision, identify the ambiguity instead of inventing semantics.

## Engineering boundaries

- Keep policy evaluation deterministic, framework-independent, and side-effect free.
- Load thresholds and actions from `src/data/policy.json`; do not duplicate policy logic in routes or UI.
- Keep HTTP handlers thin and persistence behind a repository interface.
- Separate access evaluation from consent-request creation.
- Never allow parental consent to override a hard policy block.
- Do not claim durable storage, authorization, concurrency guarantees, or auditability that the implementation does not provide.

## Claude-specific workflow

Work on one approved milestone at a time. State its scope and verification, implement only that scope, report the diff and evidence, then stop for human review. Do not begin the next milestone automatically.

Before final handoff, remove empty-suite allowances, run the full verification ladder, reconcile documentation with delivered behavior, and update `AI-USE.md` with actual events.

## Safety

- Never add credentials or expose local configuration.
- Never weaken or delete a failing test merely to make a gate pass.
