# Claude Code Instructions

Follow [`AGENTS.md`](AGENTS.md) as the repository-wide collaboration contract. Its Workflow section diagrams the end-to-end loop: scope one milestone, implement with tests, adversarial review, fix, mutation check, verify, document, human review.

Read the sources listed in [`AGENTS.md`](AGENTS.md) before changing code. When they do not resolve a product decision, identify the ambiguity instead of inventing semantics.

## Engineering boundaries

- Keep policy evaluation deterministic, framework-independent, and side-effect free.
- Load thresholds and actions from [`src/data/policy.json`](src/data/policy.json); do not duplicate policy logic in routes or UI.
- Keep HTTP handlers thin and persistence behind a repository interface.
- Separate access evaluation from consent-request creation.
- Never allow parental consent to override a hard policy block.
- Do not claim durable storage, authorization, concurrency guarantees, or auditability that the implementation does not provide.

## Claude-specific workflow

Stop at each milestone boundary: report the diff and verification evidence; do not start the next milestone until it is approved.

## Safety

- Never commit or expose credentials, secrets, or local configuration.
- Never weaken or delete a failing test merely to make a gate pass.
