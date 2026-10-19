"use client";

import {
  consentStatusLabel,
  decisionLabel,
  featureLabel,
  humanizeCode,
  reasonLabel,
} from "@/application/labels";
import HelpTip from "@/components/HelpTip";
import type { DemoScenario } from "@/demo/scenarios";
import type { ConsentRequest, DecisionResult } from "@/domain/types";

const DECISION_ICON: Record<DecisionResult["decision"], string> = {
  allowed: "✓",
  blocked: "⛔",
  parental_consent: "⏳",
};

function subtitleFor(reason: DecisionResult["reason"]): string {
  switch (reason) {
    case "meets_minimum_age":
      return "The subject meets the minimum age for this feature.";
    case "under_minimum_age":
      return "The subject is below the minimum age for this feature.";
    case "parental_consent_required":
      return "A parent must approve this feature before it can be used.";
    case "parental_consent_pending":
      return "A parent must approve this feature; the request is waiting.";
    case "parental_consent_approved":
      return "A parent approved this feature.";
    case "parental_consent_declined":
      return "A parent declined this feature.";
    case "no_matching_policy":
      return "No policy covers this jurisdiction and feature; access fails closed.";
  }
}

export function decisionSummary(
  decision: DecisionResult,
  request: ConsentRequest | null,
): string {
  const status = request ? ` Status: ${consentStatusLabel(request.status)}.` : "";
  return `${decisionLabel(decision.decision)}. ${subtitleFor(decision.reason)}${status}`;
}

export default function DecisionCard({
  decision,
  preset,
  request,
  canAskParent,
  onAskParent,
  busy,
}: {
  decision: DecisionResult;
  preset: DemoScenario | null;
  request: ConsentRequest | null;
  canAskParent: boolean;
  onAskParent: () => void;
  busy: boolean;
}) {
  const pending =
    decision.reason === "parental_consent_pending" || request?.status === "pending";
  // The advertised expectation describes the initial evaluation. After a
  // request exists, the actual decision legitimately changes.
  const showDemoCheck =
    preset !== null && request === null && decision.consentRequestId === undefined;
  const demoMatches =
    preset !== null &&
    preset.expected.decision === decision.decision &&
    preset.expected.reason === decision.reason;

  return (
    <article
      className={`decision decision-${decision.decision}`}
      data-testid="decision-card"
    >
      <div className="decision-header">
        <span className="decision-icon" aria-hidden="true">
          {DECISION_ICON[decision.decision]}
        </span>
        <div>
          <strong className="decision-title" data-testid="decision">
            {decisionLabel(decision.decision)}
          </strong>
          <p className="decision-subtitle">{subtitleFor(decision.reason)}</p>
        </div>
      </div>

      {request ? (
        <div className="decision-status">
          <span
            className={`status status-${request.status}`}
            data-testid="decision-request-status"
          >
            {consentStatusLabel(request.status)}
          </span>
          <span className="muted">Request {request.id.slice(0, 8)}</span>
          {pending ? (
            <span className="muted" data-testid="waiting">
              Waiting for parent
            </span>
          ) : null}
        </div>
      ) : null}

      <dl className="decision-evidence">
        <dt>Age</dt>
        <dd>{decision.age}</dd>
        <dt>Evaluated</dt>
        <dd>
          <span data-testid="evaluated-at">{decision.evaluatedAt}</span>
        </dd>
        <dt>Jurisdiction</dt>
        <dd>
          <code data-testid="lookup-path">{decision.lookupPath.join(" → ")}</code>
        </dd>
        <dt>Matched rule</dt>
        <dd>
          <code data-testid="matched-rule">
            {decision.matchedRule
              ? `${decision.matchedRule.jurisdiction} · ${featureLabel(decision.matchedRule.feature)} · min ${decision.matchedRule.minAge} · ${humanizeCode(decision.matchedRule.ifUnder)}`
              : "No matching rule"}
          </code>
        </dd>
        <dt>Reason</dt>
        <dd>
          <span data-testid="reason-label">{reasonLabel(decision.reason)}</span>{" "}
          <code data-testid="reason">{decision.reason}</code>
        </dd>
      </dl>

      {showDemoCheck && preset ? (
        <div className="decision-demo" data-testid="expected-actual">
          <p className={demoMatches ? "demo-ok" : "demo-warn"}>
            {demoMatches
              ? "✓ Demo expectation matched"
              : "⚠ Demo expectation differed"}
          </p>
          <div>
            <span className="muted">Expected</span>{" "}
            {decisionLabel(preset.expected.decision)} (
            {reasonLabel(preset.expected.reason)})
          </div>
          <div>
            <span className="muted">Actual</span>{" "}
            {decisionLabel(decision.decision)} ({reasonLabel(decision.reason)})
          </div>
        </div>
      ) : null}

      {canAskParent ? (
        <div className="decision-actions">
          <HelpTip id="ask-parent" label="About asking a parent" align="right">
            Creates or reuses a pending consent request for this subject and
            feature. A trusted parent can then approve, decline, or reverse it.
          </HelpTip>
          <button
            className="primary"
            type="button"
            onClick={onAskParent}
            disabled={busy}
          >
            Ask a parent
          </button>
        </div>
      ) : null}
    </article>
  );
}
