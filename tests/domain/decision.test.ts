import { describe, expect, it } from "vitest";
import briefPolicyJson from "@/data/policy.json";
import { evaluateDecision } from "@/domain/decision";
import { loadPolicy } from "@/domain/policy";
import { parseScenario } from "@/domain/scenario";
import type { ConsentStatus, Policy, Scenario } from "@/domain/types";

const policy = loadPolicy(briefPolicyJson);
const evaluationDate = "2026-10-19";

function scenarioFor(overrides: Partial<Scenario> = {}, inputPolicy: Policy = policy): Scenario {
  return parseScenario(
    {
      subjectId: "subject-1",
      dateOfBirth: "2015-03-01",
      jurisdiction: "DE",
      feature: "chat",
      ...overrides,
    },
    inputPolicy,
  );
}

describe("evaluateDecision", () => {
  it("requires consent for a German child using chat", () => {
    const result = evaluateDecision({ scenario: scenarioFor(), policy, evaluationDate });

    expect(result).toMatchObject({
      decision: "parental_consent",
      reason: "parental_consent_required",
      age: 11,
      evaluatedAt: evaluationDate,
      lookupPath: ["DE"],
      matchedRule: { jurisdiction: "DE", feature: "chat", minAge: 16, ifUnder: "parental_consent" },
    });
  });

  it("allows an adult", () => {
    const result = evaluateDecision({
      scenario: scenarioFor({ dateOfBirth: "1990-06-15", jurisdiction: "US", feature: "purchases" }),
      policy,
      evaluationDate,
    });

    expect(result.decision).toBe("allowed");
    expect(result.reason).toBe("meets_minimum_age");
    expect(result.lookupPath).toEqual(["US"]);
  });

  const consentCases: Array<[ConsentStatus | null, string, string]> = [
    [null, "parental_consent", "parental_consent_required"],
    ["pending", "parental_consent", "parental_consent_pending"],
    ["approved", "allowed", "parental_consent_approved"],
    ["declined", "blocked", "parental_consent_declined"],
  ];

  it.each(consentCases)("maps consent state %s to %s / %s", (consentStatus, decision, reason) => {
    const result = evaluateDecision({
      scenario: scenarioFor(),
      policy,
      evaluationDate,
      consentStatus,
    });

    expect(result.decision).toBe(decision);
    expect(result.reason).toBe(reason);
  });

  it("never lets an approved consent override a hard block", () => {
    const result = evaluateDecision({
      scenario: scenarioFor({ jurisdiction: "GB" }),
      policy,
      evaluationDate,
      consentStatus: "approved",
    });

    expect(result.decision).toBe("blocked");
    expect(result.reason).toBe("under_minimum_age");
    expect(result.matchedRule?.jurisdiction).toBe("GB");
  });

  it("falls back from an unlisted subdivision to the country", () => {
    const result = evaluateDecision({
      scenario: scenarioFor({ dateOfBirth: "2014-01-01", jurisdiction: "US-NY" }),
      policy,
      evaluationDate,
    });

    expect(result.decision).toBe("parental_consent");
    expect(result.matchedRule?.jurisdiction).toBe("US");
    expect(result.lookupPath).toEqual(["US-NY", "US"]);
  });

  it("uses the wildcard for a well-formed but unknown country", () => {
    const chat = evaluateDecision({
      scenario: scenarioFor({ jurisdiction: "FR" }),
      policy,
      evaluationDate,
    });
    const photo = evaluateDecision({
      scenario: scenarioFor({ jurisdiction: "FR", feature: "profile_photo" }),
      policy,
      evaluationDate,
    });

    expect(chat.decision).toBe("parental_consent");
    expect(chat.matchedRule?.jurisdiction).toBe("*");
    expect(chat.lookupPath).toEqual(["FR", "*"]);
    expect(photo.decision).toBe("blocked");
    expect(photo.reason).toBe("under_minimum_age");
  });

  it("ignores a declined consent once the subject meets the minimum age", () => {
    const result = evaluateDecision({
      scenario: scenarioFor({ dateOfBirth: "2000-01-01" }),
      policy,
      evaluationDate,
      consentStatus: "declined",
    });

    expect(result.decision).toBe("allowed");
    expect(result.reason).toBe("meets_minimum_age");
  });

  it.each<ConsentStatus>(["pending", "approved", "declined"])(
    "ignores %s consent on a hard block",
    (consentStatus) => {
      const result = evaluateDecision({
        scenario: scenarioFor({ jurisdiction: "US-TX", feature: "video_upload" }),
        policy,
        evaluationDate,
        consentStatus,
      });

      expect(result.decision).toBe("blocked");
      expect(result.reason).toBe("under_minimum_age");
    },
  );

  it("keeps missing coverage fail-closed even with an approved consent", () => {
    const result = evaluateDecision({
      scenario: scenarioFor({ jurisdiction: "ZZ", feature: "purchases" }),
      policy,
      evaluationDate,
      consentStatus: "approved",
    });

    expect(result.decision).toBe("blocked");
    expect(result.reason).toBe("no_matching_policy");
  });

  it("applies the February 29 transition at decision level", () => {
    const leapPolicy = loadPolicy({
      features: ["chat"],
      rules: [{ jurisdiction: "*", feature: "chat", min_age: 17, if_under: "blocked" }],
    });
    const decisionFor = (date: string) =>
      evaluateDecision({
        scenario: parseScenario(
          {
            subjectId: "subject-1",
            dateOfBirth: "2008-02-29",
            jurisdiction: "DE",
            feature: "chat",
          },
          leapPolicy,
        ),
        policy: leapPolicy,
        evaluationDate: date,
      });

    const dayBefore = decisionFor("2025-02-28");
    const onTransition = decisionFor("2025-03-01");

    expect(dayBefore.age).toBe(16);
    expect(dayBefore.decision).toBe("blocked");
    expect(onTransition.age).toBe(17);
    expect(onTransition.decision).toBe("allowed");
  });

  it("prefers California over country and wildcard", () => {
    const result = evaluateDecision({
      scenario: scenarioFor({ dateOfBirth: "2011-06-15", jurisdiction: "US-CA" }),
      policy,
      evaluationDate,
    });

    expect(result.decision).toBe("parental_consent");
    expect(result.matchedRule?.jurisdiction).toBe("US-CA");
    expect(result.matchedRule?.minAge).toBe(16);
    expect(result.lookupPath).toEqual(["US-CA"]);
  });

  it("blocks a Texas minor from video upload", () => {
    const result = evaluateDecision({
      scenario: scenarioFor({ jurisdiction: "US-TX", feature: "video_upload" }),
      policy,
      evaluationDate,
    });

    expect(result.decision).toBe("blocked");
    expect(result.reason).toBe("under_minimum_age");
    expect(result.matchedRule?.jurisdiction).toBe("US-TX");
  });

  it("fails closed when no rule covers the scenario", () => {
    const result = evaluateDecision({
      scenario: scenarioFor({ jurisdiction: "ZZ", feature: "purchases" }),
      policy,
      evaluationDate,
    });

    expect(result.decision).toBe("blocked");
    expect(result.reason).toBe("no_matching_policy");
    expect(result.matchedRule).toBeNull();
    expect(result.lookupPath).toEqual(["ZZ", "*"]);
  });

  it("changes the answer exactly on the birthday", () => {
    const onBirthday = evaluateDecision({
      scenario: scenarioFor({ dateOfBirth: "2010-10-19" }),
      policy,
      evaluationDate,
    });
    const dayBefore = evaluateDecision({
      scenario: scenarioFor({ dateOfBirth: "2010-10-20" }),
      policy,
      evaluationDate,
    });

    expect(onBirthday.decision).toBe("allowed");
    expect(onBirthday.age).toBe(16);
    expect(dayBefore.decision).toBe("parental_consent");
    expect(dayBefore.age).toBe(15);
  });

  it("does not depend on policy file order", () => {
    const reversedPolicy = loadPolicy({
      ...briefPolicyJson,
      rules: [...briefPolicyJson.rules].reverse(),
    });

    const original = evaluateDecision({
      scenario: scenarioFor({ dateOfBirth: "2011-06-15", jurisdiction: "US-CA" }, policy),
      policy,
      evaluationDate,
    });
    const reversed = evaluateDecision({
      scenario: scenarioFor({ dateOfBirth: "2011-06-15", jurisdiction: "US-CA" }, reversedPolicy),
      policy: reversedPolicy,
      evaluationDate,
    });

    expect(reversed).toEqual(original);
  });

  it("passes the consent request id through the result", () => {
    const result = evaluateDecision({
      scenario: scenarioFor(),
      policy,
      evaluationDate,
      consentStatus: "pending",
      consentRequestId: "consent-1",
    });

    expect(result.consentRequestId).toBe("consent-1");
  });
});
