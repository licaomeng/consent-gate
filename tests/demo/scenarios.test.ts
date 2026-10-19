import { describe, expect, it } from "vitest";
import policyJson from "@/data/policy.json";
import { calculateAge } from "@/domain/age";
import { evaluateDecision } from "@/domain/decision";
import { loadPolicy } from "@/domain/policy";
import { parseScenario } from "@/domain/scenario";
import {
  DEMO_SCENARIOS,
  dateOfBirthForAge,
  materializeDemoScenario,
} from "@/demo/scenarios";

const policy = loadPolicy(policyJson);
const subjectId = "demo-subject";
const EVALUATION_DATES = [
  "2026-10-19",
  "2027-06-15",
  "2028-03-01",
  "2040-01-01",
];

const cases = EVALUATION_DATES.flatMap((date) =>
  DEMO_SCENARIOS.map((demo) => ({
    date,
    demo,
    name: `${date} · ${demo.label}`,
  })),
);

describe("DEMO_SCENARIOS", () => {
  it("contains eight unique cases", () => {
    expect(DEMO_SCENARIOS).toHaveLength(8);
    expect(new Set(DEMO_SCENARIOS.map((demo) => demo.id)).size).toBe(8);
  });

  it.each(cases)("matches the real engine: $name", ({ date, demo }) => {
    const scenario = parseScenario(
      materializeDemoScenario(demo, subjectId, date),
      policy,
    );

    const result = evaluateDecision({ scenario, policy, evaluationDate: date });

    expect({ decision: result.decision, reason: result.reason }).toEqual(
      demo.expected,
    );
  });

  it("derives a date of birth with the requested age on any date", () => {
    const cases: Array<[string, number]> = [
      ["2026-10-19", 15],
      ["2027-06-15", 15],
      ["2028-02-29", 16],
      ["2026-01-01", 11],
    ];

    for (const [date, age] of cases) {
      const dateOfBirth = dateOfBirthForAge(date, age);
      expect(calculateAge(dateOfBirth, date)).toBe(age);
    }
  });
});
