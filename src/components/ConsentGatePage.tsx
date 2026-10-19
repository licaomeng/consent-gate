"use client";

import { useEffect, useRef, useState } from "react";
import {
  consentStatusLabel,
  expectedTagLabel,
  featureLabel,
  humanizeCode,
} from "@/application/labels";
import DecisionCard, { decisionSummary } from "@/components/DecisionCard";
import HelpTip from "@/components/HelpTip";
import {
  actionsFor,
  findRequestForScenario,
  isStale,
  type UiPhase,
} from "@/application/workflow";
import {
  dateOfBirthForAge,
  materializeDemoScenario,
  type DemoScenario,
} from "@/demo/scenarios";
import type {
  ConsentRequest,
  DecisionResult,
  Policy,
  Scenario,
} from "@/domain/types";

type Draft = {
  subjectId: string;
  dateOfBirth: string;
  jurisdiction: string;
  feature: string;
};

type ApiErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

const PHASE_LABEL: Record<UiPhase, string> = {
  idle: "",
  checking: "Checking access…",
  creating_request: "Creating the consent request…",
  updating_request: "Updating the request…",
};

function randomId(): string {
  if (typeof crypto !== "undefined") {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === "function") {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function newSubjectId(prefix: string): string {
  return `${prefix}-${randomId()}`;
}

// The full id is the capability for reading or changing a consent request.
// Shorten it only for display, never for storage or requests.
function displaySubjectId(id: string): string {
  const uuid = id.match(
    /^(.*-)([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );
  if (uuid) return `${uuid[1]}${uuid[2]}`;
  const hex = id.match(/^(.*-)([0-9a-f]{8})[0-9a-f]{24}$/i);
  if (hex) return `${hex[1]}${hex[2]}`;
  return id;
}

function utcTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function errorMessage(body: unknown): string {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as ApiErrorBody).error;
    if (error && typeof error.message === "string") {
      return error.message;
    }
  }
  return "The request failed.";
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return { error: { code: "internal_error", message: "Invalid server response." } };
  }
}

export default function ConsentGatePage({
  policy,
  presets,
  evaluationDate,
}: {
  policy: Policy;
  presets: readonly DemoScenario[];
  evaluationDate: string;
}) {
  const [draft, setDraft] = useState<Draft>({
    subjectId: "",
    dateOfBirth: dateOfBirthForAge(evaluationDate, 11),
    jurisdiction: "DE",
    feature: "chat",
  });
  const [active, setActive] = useState<Scenario | null>(null);
  const [decision, setDecision] = useState<DecisionResult | null>(null);
  const [request, setRequest] = useState<ConsentRequest | null>(null);
  const [requests, setRequests] = useState<ConsentRequest[]>([]);
  const [phase, setPhase] = useState<UiPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [presetHint, setPresetHint] = useState<DemoScenario | null>(null);
  // The UI serializes operations (busy disables actions and inputs). Token
  // checks remain as defence in depth against a future overlapping-request
  // change; they are not reachable through the current controls.
  const tokenRef = useRef(0);

  // A random subject id is generated after mount, not during render, so the
  // server-rendered markup and the hydrated client agree.
  useEffect(() => {
    setDraft((current) =>
      current.subjectId ? current : { ...current, subjectId: newSubjectId("demo") },
    );
  }, []);

  const busy = phase !== "idle";
  const actions = actionsFor(decision, request);
  const otherRequests = requests.filter((entry) => entry.id !== request?.id);
  const policyRows = [...policy.rules].sort((left, right) => {
    const rank = (jurisdiction: string) =>
      jurisdiction === "*" ? 2 : jurisdiction.includes("-") ? 0 : 1;
    return (
      rank(left.jurisdiction) - rank(right.jurisdiction) ||
      left.jurisdiction.localeCompare(right.jurisdiction) ||
      left.feature.localeCompare(right.feature)
    );
  });

  function invalidateResults(): void {
    tokenRef.current += 1;
    setActive(null);
    setDecision(null);
    setRequest(null);
    setRequests([]);
    setError(null);
    setPresetHint(null);
    setPhase("idle");
  }

  function updateDraft(patch: Partial<Draft>): void {
    // Editing during an in-flight write would drop the response after the
    // server may already have committed it. The inputs are disabled too.
    if (busy) return;
    invalidateResults();
    setDraft((current) => ({ ...current, ...patch }));
  }

  function selectPreset(preset: DemoScenario): void {
    invalidateResults();
    setPresetHint(preset);
    setDraft(materializeDemoScenario(preset, newSubjectId(preset.id), evaluationDate));
  }

  function createNewSubject(): void {
    if (busy) return;
    invalidateResults();
    setDraft((current) => ({
      ...current,
      subjectId: newSubjectId("manual"),
    }));
  }

  function begin(nextPhase: Exclude<UiPhase, "idle">): number {
    const token = tokenRef.current + 1;
    tokenRef.current = token;
    setPhase(nextPhase);
    setError(null);
    return token;
  }

  async function fetchRequestsFor(scenario: Scenario): Promise<ConsentRequest[]> {
    const response = await fetch(
      `/api/v1/consent-requests?subjectId=${encodeURIComponent(scenario.subjectId)}`,
    );
    // A failed read must not be manufactured into "no request": that would
    // wrongly re-expose "Ask a parent" for a pending request.
    if (!response.ok) {
      throw new Error("Consent state could not be read — the check was not completed.");
    }
    const body = (await response.json()) as { requests?: ConsentRequest[] };
    return body.requests ?? [];
  }

  async function checkAccess(): Promise<void> {
    if (!draft.subjectId || busy) return;
    const scenario: Scenario = { ...draft };
    const token = begin("checking");

    try {
      const response = await fetch("/api/v1/decisions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(scenario),
      });
      const body = await readBody(response);
      if (isStale(tokenRef.current, token)) return;

      if (!response.ok) {
        setError(errorMessage(body));
        setPhase("idle");
        return;
      }

      const evaluated = body as DecisionResult;
      // lookupPath starts with the server-normalized jurisdiction. Use it for
      // the scope match instead of duplicating the normalization rule here.
      const normalizedScenario: Scenario = {
        ...scenario,
        jurisdiction: evaluated.lookupPath[0] ?? scenario.jurisdiction,
      };
      const currentRequests = await fetchRequestsFor(normalizedScenario);
      if (isStale(tokenRef.current, token)) return;

      setActive(normalizedScenario);
      setDecision(evaluated);
      setRequests(currentRequests);
      setRequest(findRequestForScenario(currentRequests, normalizedScenario));
      setPhase("idle");
    } catch (cause) {
      if (isStale(tokenRef.current, token)) return;
      setActive(null);
      setDecision(null);
      setRequest(null);
      setRequests([]);
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "Network error — the decision was not evaluated.",
      );
      setPhase("idle");
    }
  }

  async function askParent(): Promise<void> {
    if (!active || busy) return;
    const token = begin("creating_request");

    try {
      const response = await fetch("/api/v1/consent-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(active),
      });
      const body = await readBody(response);
      if (isStale(tokenRef.current, token)) return;

      if (!response.ok) {
        setError(errorMessage(body));
        setPhase("idle");
        return;
      }

      const payload = body as {
        request: ConsentRequest;
        decision: DecisionResult;
      };
      setRequest(payload.request);
      setRequests((current) => [
        payload.request,
        ...current.filter((entry) => entry.id !== payload.request.id),
      ]);
      setDecision(payload.decision);
      setPhase("idle");
    } catch {
      if (isStale(tokenRef.current, token)) return;
      setError("Network error — the request was not created.");
      setPhase("idle");
    }
  }

  async function setParentDecision(status: "approved" | "declined"): Promise<void> {
    if (!active || !request || busy) return;
    const token = begin("updating_request");
    let updated: ConsentRequest | null = null;

    function commitRequest(entry: ConsentRequest): void {
      setRequest(entry);
      setRequests((current) =>
        current.map((item) => (item.id === entry.id ? entry : item)),
      );
    }

    try {
      const updateResponse = await fetch(
        `/api/v1/consent-requests/${encodeURIComponent(request.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const updateBody = await readBody(updateResponse);
      if (isStale(tokenRef.current, token)) return;

      if (!updateResponse.ok) {
        setError(errorMessage(updateBody));
        setPhase("idle");
        return;
      }
      updated = updateBody as ConsentRequest;

      // No optimistic update: run a fresh decision after the parent action.
      const decisionResponse = await fetch("/api/v1/decisions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(active),
      });
      const decisionBody = await readBody(decisionResponse);
      if (isStale(tokenRef.current, token)) return;

      if (!decisionResponse.ok) {
        // The write succeeded but the fresh evidence did not. Commit the new
        // status alone and clear the stale decision.
        commitRequest(updated);
        setDecision(null);
        setError(
          "Request updated, but the fresh decision could not be evaluated. Check access to retry.",
        );
        setPhase("idle");
        return;
      }

      // Commit the status and the fresh decision in one render so the live
      // summary never announces a mixed state such as "needs consent ·
      // approved".
      commitRequest(updated);
      setDecision(decisionBody as DecisionResult);
      setPhase("idle");
    } catch {
      if (isStale(tokenRef.current, token)) return;
      if (updated) commitRequest(updated);
      setDecision(null);
      setError("Network error — the request may have been updated; check access to refresh.");
      setPhase("idle");
    }
  }

  return (
    <main className="page">
      <header className="masthead">
        <p className="eyebrow">CONSENT GATE</p>
        <h1>
          <span>Decide access.</span>
          <span className="title-accent">Ask a parent when it matters.</span>
        </h1>
        <p className="intro">
          A small policy engine that applies jurisdiction rules and keeps the
          latest parental decision. The server evaluates every rule; this page
          only renders the evidence.
        </p>
      </header>

      <section className="scenario-panel" aria-labelledby="demo-heading">
        <div className="section-heading compact-heading">
          <span className="step" aria-hidden="true">0</span>
          <div>
            <div className="heading-line">
              <h2 id="demo-heading">Choose a demo case</h2>
              <HelpTip id="demo-cases" label="About demo cases">
                Each demo creates a fresh synthetic subject and fills the form
                with its scenario. The expected tag is presentation-only; the
                server evaluates the real decision.
              </HelpTip>
            </div>
            <p>Each selection creates a fresh synthetic subject, so every walkthrough starts clean.</p>
          </div>
        </div>
        <div className="scenario-grid">
          {presets.map((preset) => {
            const selected = presetHint?.id === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                className={`scenario${selected ? " scenario-selected" : ""}`}
                aria-pressed={selected}
                aria-label={`${preset.label}: ${expectedTagLabel(preset.expected.decision)}`}
                aria-describedby={`${preset.id}-purpose`}
                data-testid={`demo-${preset.id}`}
                onClick={() => selectPreset(preset)}
                disabled={busy}
              >
                <span
                  className={`expected expected-${preset.expected.decision}`}
                  data-testid={`expected-${preset.id}`}
                >
                  {expectedTagLabel(preset.expected.decision)}
                </span>
                <strong>{preset.label}</strong>
                <small id={`${preset.id}-purpose`}>{preset.purpose}</small>
              </button>
            );
          })}
        </div>
      </section>

      {error ? (
        <div className="alert" role="alert" data-testid="error">
          {error}
        </div>
      ) : null}

      <div className="workspace">
        <section className="panel" aria-labelledby="child-heading" aria-busy={busy}>
          <div className="section-heading">
            <span className="step" aria-hidden="true">1</span>
            <div>
              <h2 id="child-heading">Check feature access</h2>
              <p>Acting as the child&apos;s product experience.</p>
            </div>
          </div>
          <div className="subject-line">
            <p className="subject">
              Demo subject:{" "}
              <code>{draft.subjectId ? displaySubjectId(draft.subjectId) : "…"}</code>
            </p>
            <div className="subject-actions">
              <button
                className="secondary small"
                type="button"
                data-testid="new-subject"
                onClick={createNewSubject}
                disabled={busy}
              >
                New subject
              </button>
              <HelpTip id="new-subject" label="About New subject" align="right">
                Creates a new synthetic subject. Earlier consent for the previous
                subject is not reused; the server records stay in memory.
              </HelpTip>
            </div>
          </div>

          <form
            className="scenario-form"
            onSubmit={(event) => {
              event.preventDefault();
              void checkAccess();
            }}
          >
            <label htmlFor="date-of-birth">Date of birth</label>
            <input
              id="date-of-birth"
              type="date"
              value={draft.dateOfBirth}
              disabled={busy}
              onChange={(event) => updateDraft({ dateOfBirth: event.target.value })}
            />

            <label htmlFor="jurisdiction">Jurisdiction</label>
            <input
              id="jurisdiction"
              value={draft.jurisdiction}
              disabled={busy}
              onChange={(event) => updateDraft({ jurisdiction: event.target.value })}
            />

            <label htmlFor="feature">Feature</label>
            <select
              id="feature"
              value={draft.feature}
              disabled={busy}
              onChange={(event) => updateDraft({ feature: event.target.value })}
            >
              {policy.features.map((feature) => (
                <option key={feature} value={feature}>
                  {featureLabel(feature)}
                </option>
              ))}
            </select>

            <button className="primary" type="submit" disabled={busy || !draft.subjectId}>
              Check access
            </button>
          </form>

          <p
            className="sr-only"
            role="status"
            aria-live="polite"
            data-testid="decision-summary"
          >
            {decision ? decisionSummary(decision, request) : ""}
          </p>

          <div className="result" data-testid="result-region">
            {decision ? (
              <DecisionCard
                decision={decision}
                preset={presetHint}
                request={request}
                canAskParent={actions.canAskParent}
                onAskParent={() => void askParent()}
                busy={busy}
              />
            ) : (
              <p className="muted">
                Check access to see the server&apos;s decision and evidence.
              </p>
            )}
          </div>

          <p
            className="muted"
            role="status"
            aria-live="polite"
            data-testid="progress"
          >
            {busy ? PHASE_LABEL[phase] : ""}
          </p>
        </section>

        <section className="panel" aria-labelledby="parent-heading">
          <div className="section-heading">
            <span className="step" aria-hidden="true">2</span>
            <div>
              <div className="heading-line">
                <h2 id="parent-heading">Parent decisions</h2>
                <HelpTip id="parent-decisions" label="About parent decisions">
                  Pending: waiting for a parent. Approved: allowed. Declined:
                  blocked, and the parent can reverse the decision.
                </HelpTip>
              </div>
              <p>A trusted parent view for this exercise.</p>
            </div>
          </div>
          {request ? (
            <>
              <p className="muted">
                {featureLabel(request.feature)} · {request.jurisdiction} ·{" "}
                <code>{displaySubjectId(request.subjectId)}</code>
              </p>
              <p className="request-status-line">
                Status:{" "}
                <span
                  className={`status status-${request.status}`}
                  data-testid="request-status"
                >
                  {consentStatusLabel(request.status)}
                </span>
              </p>
              <p className="muted" data-testid="request-timestamps">
                Created{" "}
                <time dateTime={request.createdAt}>
                  {utcTimestamp(request.createdAt)}
                </time>{" "}
                · Updated{" "}
                <time dateTime={request.updatedAt}>
                  {utcTimestamp(request.updatedAt)}
                </time>
              </p>
              <div className="button-row">
                <button
                  className="approve"
                  type="button"
                  onClick={() => void setParentDecision("approved")}
                  disabled={busy || !actions.canApprove}
                >
                  Approve
                </button>
                <button
                  className="decline"
                  type="button"
                  onClick={() => void setParentDecision("declined")}
                  disabled={busy || !actions.canDecline}
                >
                  Decline
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p>No consent request for this subject and feature.</p>
              <span>
                Check an underage feature, then choose &ldquo;Ask a parent&rdquo;.
              </span>
            </div>
          )}
          {otherRequests.length > 0 ? (
            <div className="other-requests" data-testid="other-requests">
              <p className="muted">Other requests for this subject</p>
              <ul>
                {otherRequests.map((entry) => (
                  <li key={entry.id}>
                    <span>
                      {featureLabel(entry.feature)} · {entry.jurisdiction}
                    </span>
                    <span className={`status status-${entry.status}`}>
                      {consentStatusLabel(entry.status)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>

      <section className="panel policy" aria-labelledby="policy-heading">
        <div className="section-heading compact-heading">
          <span className="step" aria-hidden="true">3</span>
          <div>
            <h2 id="policy-heading">Policy reference</h2>
            <p>
              The engine checks the most specific jurisdiction first: region,
              country, then global <code>*</code> (any jurisdiction). File order
              does not decide precedence; this table is grouped by specificity.
            </p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">
              Policy rules used by the decision engine
            </caption>
            <thead>
              <tr>
                <th scope="col">Jurisdiction</th>
                <th scope="col">Feature</th>
                <th scope="col">Minimum age</th>
                <th scope="col">If under</th>
              </tr>
            </thead>
            <tbody>
              {policyRows.map((rule) => {
                const matched =
                  decision?.matchedRule?.jurisdiction === rule.jurisdiction &&
                  decision.matchedRule.feature === rule.feature;
                return (
                  <tr
                    key={`${rule.jurisdiction}-${rule.feature}`}
                    className={matched ? "matched" : undefined}
                  >
                    <td>{rule.jurisdiction === "*" ? "Global (*)" : rule.jurisdiction}</td>
                    <td>{featureLabel(rule.feature)}</td>
                    <td>{rule.minAge}</td>
                    <td className="capitalize">{humanizeCode(rule.ifUnder)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="policy-source">
          Source of truth: <code>src/data/policy.json</code>
        </p>
        <p className="demo-storage-note">
          Demo storage is in memory. Consent records may reset when the service
          restarts or redeploys; every preset creates a fresh synthetic subject
          and uses no personal data.
        </p>
      </section>
    </main>
  );
}
