# AI Use

This is a short review portfolio, not a session log. It starts with where AI and I diverge, then gives one concrete case for each.

Each case is one where human judgment changed the outcome, not just a list of AI errors. You do not need the original session: every case states the situation, the problem, how it was found, and what now guards it; the [Details] links open the fix and its evidence. The full log records every finding; this page keeps the seven most consequential.

For document-heavy analysis (brief, design assumptions, documentation), I used OpenAI Codex because its session UI suited how I work. Claude Code implemented the service; a read-only reviewer from the same assistant checked each implementation round, so I treated its agreement as a first pass, not independent proof. The independent checks were the production smoke, the mutation runs, and my own review. The split was a workflow choice, not a capability claim.

I chose the product semantics, checked every diff and verification run, rejected unsupported claims, and own the submission. I did not delegate the consent scope, the policy semantics, or the final verification decision.

## Where AI and I diverge

AI is fast, fluent, and tireless. It is also not a person; the gaps below are the price of those strengths.

- **Perception.** It reasons over the text it can see, not the running system: the production bundle, the browser, the screen reader, or a phone viewport. (cases 1, 4, 7)
- **State over time.** It sees a snapshot, not a calendar, a retry, or the history of a decision. (cases 2, 3)
- **Global invariants.** It satisfies the local request; it does not enforce global rules such as input limits or lifecycle order. (cases 3, 6)
- **Calibration.** It is fluent without reliable confidence: it can describe intent as if it were the implementation, and it can be confidently wrong. (case 5)
- **Instrumentation.** It only knows what its tools measure. Without a production smoke, a DOM observer, or a viewport test, the gap stays invisible. (cases 1, 4, 7)
- **Accountability.** It cannot own product or legal consequences; the policy semantics and final verification stay with me.
- **Non-determinism.** The same prompt can produce different output; a result is a sample, not a guarantee.

That is why every fix below ends in a test or a guard rather than trust.

## Cases

1. **[Error handling]** The model reasoned about source modules, not the production bundle.

   AI wrote the API's error mapping with `instanceof`. The production build split `DomainError` into two bundles, so a hard-block 409 and a client-date 400 became 500. The `next start` smoke caught it. The mapper now classifies by stable name and a closed code set, and Playwright asserts 409/400/404. [Details](docs/AI-USE-LOG.md#m4-review-corrections)

2. **[Date handling]** A deterministic fixture hid the calendar.

   AI wrote the demo presets with hardcoded DOBs, and the contract test pinned one date. From 2027 the page would show an outcome the engine no longer produced. My review caught it. Presets now carry an age and derive the DOB from the server date; the contract test runs four dates through 2040. [Details](docs/AI-USE-LOG.md#m3-review-pass-2)

3. **[Consent lifecycle]** The first-request path was modeled; retries were not.

   AI's design documented every reused request as `pending` and evaluated eligibility before looking for an existing scope. A parent retrying after approval could have been rejected. My design review caught it. The code now looks up the existing scope first, returns it unchanged, and evaluates eligibility only for a new request; service tests cover the retry path. [Details](docs/AI-USE-LOG.md#early-corrections)

4. **[Accessibility]** The screen-reader timeline was invisible.

   AI made both the summary and the visible badge live regions, and a parent action updated both, so screen reader users heard the status twice. The badge lost `role`/`aria-live`; status and fresh decision commit in one render. My review caught it; a MutationObserver check quantified it. The E2E now pins one announcement. [Details](docs/AI-USE-LOG.md#m5-review-pass-3-staged-diff-follow-up)

5. **[Documentation]** The intended interaction was written as the implemented one.

   The help tooltip had hover, focus, and click states. AI's documentation claimed a click toggled it, but a click only pinned it open; a maintainer would have trusted the claim and broken the interaction. Adversarial review caught it. The docs now describe pin, hover, and focus, and Escape/outside-press dismissal is asserted. [Details](docs/AI-USE-LOG.md#m5-review-pass-3-staged-diff-follow-up)

6. **[Input validation]** Shape was checked; size and abuse were not.

   The public API parsed JSON into a scenario, but AI set no size limit: a large `subjectId` could grow the in-memory store without limit; one request could exhaust the demo. Adversarial review caught it. Bodies are capped at 8 KiB (`413 payload_too_large`), and `subjectId` at 128 characters in the body and query. Tests cover both body paths and the 413 contract. [Details](docs/AI-USE-LOG.md#m5-review-pass-4-adversarial-review-hardening)

7. **[Responsive layout]** The layout was only tested at desktop width.

   AI hid help tooltips with `opacity: 0`, but hidden elements still occupy layout. At 390px they made the document 40px wider than the viewport, forcing horizontal scroll. A phone-viewport test caught it. At 480px or below tooltips render as a bottom sheet, and the test asserts bounds and no overflow. [Details](docs/AI-USE-LOG.md#m5-review-pass-5-mobile-viewport)

## Discarded ideas

Design suggestions I rejected outright; rewritten AI output is in the cases above.

- **Editable subject identity.** The synthetic subject isolates walkthroughs without authentication.
- **Colour-only status.** Every state also carries text.
- **Client-side policy evaluation.** The server remains the only enforcement point.
- **Removing the `globalThis` container singleton.** It would reintroduce development-time state loss.

## Evidence

- **Tests:** `npm run verify` passes with 180 Vitest tests, 21 Playwright journeys, and 8/8 HTTP smoke.
- **Coverage:** 98.73% statements / 95.78% branches on server-side modules; the UI is covered by Playwright.
- **Guards:** 26/26 mutation checks red. Live: https://consent-gate.onrender.com/.

Full per-milestone log, line-level links, and the verification table: [docs/AI-USE-LOG.md](docs/AI-USE-LOG.md).
