import type { Decision, DecisionReason, Scenario } from "@/domain/types";

export type DemoScenario = {
  id: string;
  label: string;
  ageYears: number;
  jurisdiction: string;
  feature: string;
  purpose: string;
  expected: {
    decision: Decision;
    reason: DecisionReason;
  };
};

/**
 * Presentation-only metadata. The date of birth is derived from the server's
 * evaluation date, so the advertised expectation cannot drift as the calendar
 * advances. A contract test checks every preset on several future dates.
 */
export const DEMO_SCENARIOS: readonly DemoScenario[] = [
  {
    id: "us-adult-purchase",
    label: "US adult purchase",
    ageYears: 36,
    jurisdiction: "US",
    feature: "purchases",
    purpose: "Adult access is allowed by the age threshold.",
    expected: { decision: "allowed", reason: "meets_minimum_age" },
  },
  {
    id: "german-child-chat",
    label: "German child chat",
    ageYears: 11,
    jurisdiction: "DE",
    feature: "chat",
    purpose: "Full consent and reversal loop.",
    expected: { decision: "parental_consent", reason: "parental_consent_required" },
  },
  {
    id: "british-child-chat",
    label: "British child chat",
    ageYears: 11,
    jurisdiction: "GB",
    feature: "chat",
    purpose: "Exact hard block beats the global consent rule.",
    expected: { decision: "blocked", reason: "under_minimum_age" },
  },
  {
    id: "california-teen-chat",
    label: "California teen chat",
    ageYears: 15,
    jurisdiction: "US-CA",
    feature: "chat",
    purpose: "Subdivision beats country and wildcard.",
    expected: { decision: "parental_consent", reason: "parental_consent_required" },
  },
  {
    id: "texas-minor-video",
    label: "Texas minor video",
    ageYears: 11,
    jurisdiction: "US-TX",
    feature: "video_upload",
    purpose: "Subdivision-specific feature block.",
    expected: { decision: "blocked", reason: "under_minimum_age" },
  },
  {
    id: "underage-profile-photo",
    label: "Underage profile photo",
    ageYears: 11,
    jurisdiction: "US",
    feature: "profile_photo",
    purpose: "Global fallback block.",
    expected: { decision: "blocked", reason: "under_minimum_age" },
  },
  {
    id: "us-teen-purchase",
    label: "US teen purchase",
    ageYears: 16,
    jurisdiction: "US",
    feature: "purchases",
    purpose: "Feature-specific threshold.",
    expected: { decision: "parental_consent", reason: "parental_consent_required" },
  },
  {
    id: "missing-coverage",
    label: "Missing coverage",
    ageYears: 11,
    jurisdiction: "ZZ",
    feature: "purchases",
    purpose: "Coverage gap distinct from a hard block.",
    expected: { decision: "blocked", reason: "no_matching_policy" },
  },
];

/**
 * The birthday was yesterday, so the subject has exactly `ageYears` on the
 * evaluation date regardless of the calendar date.
 */
export function dateOfBirthForAge(
  evaluationDate: string,
  ageYears: number,
): string {
  const [year, month, day] = evaluationDate.split("-").map(Number);
  const birth = new Date(Date.UTC(year - ageYears, month - 1, day));
  birth.setUTCDate(birth.getUTCDate() - 1);
  return birth.toISOString().slice(0, 10);
}

export function materializeDemoScenario(
  demo: DemoScenario,
  subjectId: string,
  evaluationDate: string,
): Scenario {
  return {
    subjectId,
    dateOfBirth: dateOfBirthForAge(evaluationDate, demo.ageYears),
    jurisdiction: demo.jurisdiction,
    feature: demo.feature,
  };
}
