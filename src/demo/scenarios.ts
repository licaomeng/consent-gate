import type { Decision, DecisionReason, Scenario } from "@/domain/types";

export type DemoScenario = {
  id: string;
  label: string;
  dateOfBirth: string;
  jurisdiction: string;
  feature: string;
  purpose: string;
  expected: {
    decision: Decision;
    reason: DecisionReason;
  };
};

/**
 * Presentation-only metadata. A contract test evaluates every preset against
 * the real engine, so these expectations cannot drift silently.
 */
export const DEMO_SCENARIOS: readonly DemoScenario[] = [
  {
    id: "us-adult-purchase",
    label: "US adult purchase",
    dateOfBirth: "1990-06-15",
    jurisdiction: "US",
    feature: "purchases",
    purpose: "Adult access is allowed by the age threshold.",
    expected: { decision: "allowed", reason: "meets_minimum_age" },
  },
  {
    id: "german-child-chat",
    label: "German child chat",
    dateOfBirth: "2015-03-01",
    jurisdiction: "DE",
    feature: "chat",
    purpose: "Full consent and reversal loop.",
    expected: { decision: "parental_consent", reason: "parental_consent_required" },
  },
  {
    id: "british-child-chat",
    label: "British child chat",
    dateOfBirth: "2015-03-01",
    jurisdiction: "GB",
    feature: "chat",
    purpose: "Exact hard block beats the global consent rule.",
    expected: { decision: "blocked", reason: "under_minimum_age" },
  },
  {
    id: "california-teen-chat",
    label: "California teen chat",
    dateOfBirth: "2011-06-15",
    jurisdiction: "US-CA",
    feature: "chat",
    purpose: "Subdivision beats country and wildcard.",
    expected: { decision: "parental_consent", reason: "parental_consent_required" },
  },
  {
    id: "texas-minor-video",
    label: "Texas minor video",
    dateOfBirth: "2015-03-01",
    jurisdiction: "US-TX",
    feature: "video_upload",
    purpose: "Subdivision-specific feature block.",
    expected: { decision: "blocked", reason: "under_minimum_age" },
  },
  {
    id: "underage-profile-photo",
    label: "Underage profile photo",
    dateOfBirth: "2015-03-01",
    jurisdiction: "US",
    feature: "profile_photo",
    purpose: "Global fallback block.",
    expected: { decision: "blocked", reason: "under_minimum_age" },
  },
  {
    id: "us-teen-purchase",
    label: "US teen purchase",
    dateOfBirth: "2010-01-01",
    jurisdiction: "US",
    feature: "purchases",
    purpose: "Feature-specific threshold.",
    expected: { decision: "parental_consent", reason: "parental_consent_required" },
  },
  {
    id: "missing-coverage",
    label: "Missing coverage",
    dateOfBirth: "2015-03-01",
    jurisdiction: "ZZ",
    feature: "purchases",
    purpose: "Coverage gap distinct from a hard block.",
    expected: { decision: "blocked", reason: "no_matching_policy" },
  },
];

export function materializeDemoScenario(
  demo: DemoScenario,
  subjectId: string,
): Scenario {
  return {
    subjectId,
    dateOfBirth: demo.dateOfBirth,
    jurisdiction: demo.jurisdiction,
    feature: demo.feature,
  };
}
