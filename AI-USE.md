# AI Use

Consent Gate decides access from age, jurisdiction, and parental consent. I used OpenAI Codex for document-heavy analysis (brief, design assumptions, documentation), where its session UI suited how I work; Claude Code implemented M1–M5 and ran a read-only reviewer for M1–M4. The split was a workflow choice, not a capability claim. I chose the product semantics, checked every diff and verification run, rejected unsupported claims, and own the submission. I did not delegate the consent scope, the policy semantics, or the final verification decision.

The full log records every finding; this page keeps the seven most consequential.

## Mistakes that mattered

Each entry states what went wrong, why it mattered, and what now guards it.

1. **Cross-bundle `instanceof` turned expected 4xx into 500.** [AI output] The first error mapper used `instanceof`. The production build split `DomainError` into two bundles, so a hard-block 409 and a client-date 400 became 500. The HTTP smoke caught it; the mapper now uses the stable class name plus a closed code set, and 409/400/404 run in Playwright. [Details](docs/AI-USE-LOG.md#m4-review-corrections)
2. **Demo expectations were tied to fixed dates.** [User review] Presets hardcoded DOBs and the contract test pinned one date; from 2027 the page would show an outcome the engine no longer produced. Presets now carry an age and derive the DOB from the server's evaluation date; the contract test runs four dates through 2040. [Details](docs/AI-USE-LOG.md#m3-review-pass-2)
3. **The consent design got the retry path wrong in two ways.** [AI design] It documented every reused request as `pending`, and it evaluated eligibility before looking up an existing scope. Both would have rejected valid retries after approval. The order is now lookup, return an existing record, then evaluate new-request eligibility; retries return the stored state; service tests cover the retry path. [Details](docs/AI-USE-LOG.md#early-corrections)
4. **Two live regions announced the same status.** [User review] A parent action updated both the summary and the visible badge; screen reader users heard the status twice. The badge lost `role`/`aria-live`; status and fresh decision are committed in one render. A MutationObserver check pins the single announcement. [Details](docs/AI-USE-LOG.md#m5-review-pass-3-staged-diff-follow-up)
5. **The tooltip's "click toggles" claim did not match the behavior.** [Adversarial review] A click pinned it open, while hover or focus still kept it visible; a maintainer would have trusted the claim and broken the interaction. The docs now describe the real semantics, and Escape/outside-press dismissal is asserted. [Details](docs/AI-USE-LOG.md#m5-review-pass-3-staged-diff-follow-up)
6. **The public API had no body or subjectId limit.** [Adversarial review] A large `subjectId` could grow the in-memory store without limit, so one request could exhaust the demo. Bodies are capped at 8 KiB (`413 payload_too_large`), and `subjectId` is capped at 128 characters in the body and the list query; tests cover both body paths and the 413 contract. [Details](docs/AI-USE-LOG.md#m5-review-pass-4-adversarial-review-hardening)
7. **A hidden mobile tooltip caused horizontal overflow.** [Viewport test] Tooltips are `opacity: 0` but still laid out; at 390px they made the document 40px wider than the viewport, forcing horizontal scroll on a phone. A mobile viewport test found it; at 480px or below they now render as a bottom sheet, and the test asserts their bounds. [Details](docs/AI-USE-LOG.md#m5-review-pass-5-mobile-viewport)

## Discarded ideas

Design suggestions I rejected; rewritten AI output is in the mistakes above.

- **Editable subject identity.** The synthetic subject isolates walkthroughs without authentication.
- **Colour-only status.** Every state also carries text.
- **Client-side policy evaluation.** The server remains the only enforcement point.
- **Removing the `globalThis` container singleton.** It would reintroduce development-time state loss.

## Verification

`npm run verify` passes: 180 Vitest tests, 21 Playwright journeys, 8/8 HTTP smoke, coverage 98.73% statements / 95.78% branches on server-side modules (the UI is covered by Playwright), and 26/26 mutation checks red across M1–M5. Live: https://consent-gate.onrender.com/.

Full per-milestone log, line-level links, and the verification table: [docs/AI-USE-LOG.md](docs/AI-USE-LOG.md).
