import type { ConsentRequest, DecisionResult, Scenario } from "@/domain/types";

export type UiPhase = "idle" | "checking" | "creating_request" | "updating_request";

export type ActionAvailability = {
  canCheck: boolean;
  canAskParent: boolean;
  canApprove: boolean;
  canDecline: boolean;
};

/**
 * The action matrix from DESIGN §4. A hard block, an adult, or a coverage gap
 * never exposes "Ask a parent"; a pending request cannot be recreated.
 */
export function actionsFor(
  decision: DecisionResult | null,
  request: ConsentRequest | null,
): ActionAvailability {
  // A pending decision also has decision === "parental_consent". Asking again
  // would recreate a request, so the reason must be "required", not "pending".
  const needsConsent =
    decision?.decision === "parental_consent" &&
    decision.reason === "parental_consent_required";

  return {
    canCheck: true,
    canAskParent: needsConsent && request === null,
    canApprove: request !== null && request.status !== "approved",
    canDecline: request !== null && request.status !== "declined",
  };
}

export function isStale(currentToken: number, responseToken: number): boolean {
  return currentToken !== responseToken;
}

export function findRequestForScenario(
  requests: readonly ConsentRequest[],
  scenario: Scenario,
): ConsentRequest | null {
  return (
    requests.find(
      (request) =>
        request.subjectId === scenario.subjectId &&
        request.jurisdiction === scenario.jurisdiction &&
        request.feature === scenario.feature,
    ) ?? null
  );
}
