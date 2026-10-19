"use client";

import { useEffect, useRef, useState } from "react";
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

const DECISION_LABEL: Record<DecisionResult["decision"], string> = {
  allowed: "Allowed",
  blocked: "Blocked",
  parental_consent: "Needs parental consent",
};

const PHASE_LABEL: Record<UiPhase, string> = {
  idle: "",
  checking: "Checking access…",
  creating_request: "Creating the consent request…",
  updating_request: "Updating the request…",
};

function newSubjectId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `subject-${Math.random().toString(36).slice(2, 10)}`;
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
      current.subjectId ? current : { ...current, subjectId: newSubjectId() },
    );
  }, []);

  const busy = phase !== "idle";
  const actions = actionsFor(decision, request);

  function invalidateResults(): void {
    tokenRef.current += 1;
    setActive(null);
    setDecision(null);
    setRequest(null);
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
    setDraft(materializeDemoScenario(preset, newSubjectId(), evaluationDate));
  }

  function begin(nextPhase: Exclude<UiPhase, "idle">): number {
    const token = tokenRef.current + 1;
    tokenRef.current = token;
    setPhase(nextPhase);
    setError(null);
    return token;
  }

  async function fetchRequestFor(scenario: Scenario): Promise<ConsentRequest | null> {
    const response = await fetch(
      `/api/v1/consent-requests?subjectId=${encodeURIComponent(scenario.subjectId)}`,
    );
    // A failed read must not be manufactured into "no request": that would
    // wrongly re-expose "Ask a parent" for a pending request.
    if (!response.ok) {
      throw new Error("Consent state could not be read — the check was not completed.");
    }
    const body = (await response.json()) as { requests?: ConsentRequest[] };
    return findRequestForScenario(body.requests ?? [], scenario);
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
      const currentRequest = await fetchRequestFor(normalizedScenario);
      if (isStale(tokenRef.current, token)) return;

      setActive(normalizedScenario);
      setDecision(evaluated);
      setRequest(currentRequest);
      setPhase("idle");
    } catch (cause) {
      if (isStale(tokenRef.current, token)) return;
      setActive(null);
      setDecision(null);
      setRequest(null);
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
      setRequest(updateBody as ConsentRequest);

      // No optimistic update: run a fresh decision after the parent action.
      const decisionResponse = await fetch("/api/v1/decisions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(active),
      });
      const decisionBody = await readBody(decisionResponse);
      if (isStale(tokenRef.current, token)) return;

      if (!decisionResponse.ok) {
        // The write succeeded but the fresh evidence did not. Keeping the old
        // decision beside the new status would show contradictory evidence.
        setDecision(null);
        setError(
          "Request updated, but the fresh decision could not be evaluated. Check access to retry.",
        );
        setPhase("idle");
        return;
      }

      setDecision(decisionBody as DecisionResult);
      setPhase("idle");
    } catch {
      if (isStale(tokenRef.current, token)) return;
      setDecision(null);
      setError("Network error — the request may have been updated; check access to refresh.");
      setPhase("idle");
    }
  }

  return (
    <main className="page">
      <header className="masthead">
        <h1>Consent Gate</h1>
        <p>
          Enter a subject, jurisdiction, and feature. The server evaluates the
          policy and returns the decision with its evidence.
        </p>
      </header>

      <section className="demo-cases" aria-labelledby="demo-heading">
        <h2 id="demo-heading">Demo cases</h2>
        <div className="chip-row">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="chip"
              onClick={() => selectPreset(preset)}
              disabled={busy}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      <div className="panels">
        <section className="panel" aria-labelledby="child-heading">
          <h2 id="child-heading">Child / product</h2>
          <p className="subject">
            Demo subject: <code>{draft.subjectId || "…"}</code>
          </p>

          {presetHint ? (
            <div className="preset-hint" data-testid="preset-hint">
              <p>
                <strong>{presetHint.label}</strong> — expected:{" "}
                {DECISION_LABEL[presetHint.expected.decision]} (
                {presetHint.expected.reason})
              </p>
              <p className="muted">{presetHint.purpose}</p>
            </div>
          ) : null}

          <form
            className="scenario"
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
                  {feature}
                </option>
              ))}
            </select>

            <button type="submit" disabled={busy || !draft.subjectId}>
              Check access
            </button>
          </form>

          {error ? (
            <p className="error" role="alert" data-testid="error">
              {error}
            </p>
          ) : null}

          <div className="result" aria-live="polite">
            {decision ? (
              <>
                <p className="decision">
                  <strong data-testid="decision">
                    {DECISION_LABEL[decision.decision]}
                  </strong>
                </p>
                <p>
                  Reason: <code data-testid="reason">{decision.reason}</code>
                </p>
                <p className="muted">
                  Age {decision.age} · evaluated{" "}
                  <span data-testid="evaluated-at">{decision.evaluatedAt}</span>
                </p>
                <p>
                  Lookup:{" "}
                  <code data-testid="lookup-path">
                    {decision.lookupPath.join(" → ")}
                  </code>
                </p>
                <p>
                  Matched rule:{" "}
                  <code data-testid="matched-rule">
                    {decision.matchedRule
                      ? `${decision.matchedRule.jurisdiction} · ${decision.matchedRule.feature} · min age ${decision.matchedRule.minAge} · ${decision.matchedRule.ifUnder}`
                      : "No matching rule"}
                  </code>
                </p>
                {decision.reason === "parental_consent_pending" ? (
                  <p data-testid="waiting">
                    <strong>Waiting for parent</strong>
                  </p>
                ) : null}
              </>
            ) : (
              <p className="muted">
                Check access to see the server&apos;s decision and evidence.
              </p>
            )}
          </div>

          {actions.canAskParent ? (
            <button type="button" onClick={() => void askParent()} disabled={busy}>
              Ask a parent
            </button>
          ) : null}

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
          <h2 id="parent-heading">Trusted parent</h2>
          {request ? (
            <>
              <p className="muted">
                {request.subjectId} · {request.jurisdiction} · {request.feature}
              </p>
              <p aria-live="polite">
                Status:{" "}
                <strong data-testid="request-status">{request.status}</strong>
              </p>
              <div className="button-row">
                <button
                  type="button"
                  onClick={() => void setParentDecision("approved")}
                  disabled={busy || !actions.canApprove}
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => void setParentDecision("declined")}
                  disabled={busy || !actions.canDecline}
                >
                  Decline
                </button>
              </div>
            </>
          ) : (
            <p className="muted">No consent request for this subject and feature.</p>
          )}
        </section>
      </div>

      <section className="panel policy" aria-labelledby="policy-heading">
        <h2 id="policy-heading">Policy reference</h2>
        <table>
          <thead>
            <tr>
              <th>Jurisdiction</th>
              <th>Feature</th>
              <th>Minimum age</th>
              <th>If under</th>
            </tr>
          </thead>
          <tbody>
            {policy.rules.map((rule) => {
              const matched =
                decision?.matchedRule?.jurisdiction === rule.jurisdiction &&
                decision.matchedRule.feature === rule.feature;
              return (
                <tr
                  key={`${rule.jurisdiction}-${rule.feature}`}
                  className={matched ? "matched" : undefined}
                >
                  <td>{rule.jurisdiction}</td>
                  <td>{rule.feature}</td>
                  <td>{rule.minAge}</td>
                  <td>{rule.ifUnder}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
