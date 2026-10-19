import { calculateAge } from "./age";
import { resolveRule } from "./policy";
import type { ConsentStatus, DecisionResult, Policy, Scenario } from "./types";

export type DecisionInput = {
  scenario: Scenario;
  policy: Policy;
  evaluationDate: string;
  consentStatus?: ConsentStatus | null;
  consentRequestId?: string;
};

/**
 * Read-only evaluation. The caller supplies the consent state; this function
 * never creates or mutates it.
 */
export function evaluateDecision(input: DecisionInput): DecisionResult {
  const { scenario, policy, evaluationDate } = input;
  const age = calculateAge(scenario.dateOfBirth, evaluationDate);
  const { rule, lookupPath } = resolveRule(
    policy,
    scenario.feature,
    scenario.jurisdiction,
  );

  const base = {
    age,
    evaluatedAt: evaluationDate,
    lookupPath,
    matchedRule: rule,
    consentRequestId: input.consentRequestId,
  };

  if (!rule) {
    return { ...base, decision: "blocked", reason: "no_matching_policy" };
  }

  if (age >= rule.minAge) {
    return { ...base, decision: "allowed", reason: "meets_minimum_age" };
  }

  // A hard block is never overridden by consent, including an old approval.
  if (rule.ifUnder === "blocked") {
    return { ...base, decision: "blocked", reason: "under_minimum_age" };
  }

  switch (input.consentStatus ?? null) {
    case "approved":
      return { ...base, decision: "allowed", reason: "parental_consent_approved" };
    case "declined":
      return { ...base, decision: "blocked", reason: "parental_consent_declined" };
    case "pending":
      return { ...base, decision: "parental_consent", reason: "parental_consent_pending" };
    default:
      return {
        ...base,
        decision: "parental_consent",
        reason: "parental_consent_required",
      };
  }
}
