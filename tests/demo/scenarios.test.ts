import { describe, expect, it } from "vitest";
import policyJson from "@/data/policy.json";
import { evaluateDecision } from "@/domain/decision";
import { loadPolicy } from "@/domain/policy";
import { parseScenario } from "@/domain/scenario";
import { DEMO_SCENARIOS, materializeDemoScenario } from "@/demo/scenarios";

const policy = loadPolicy(policyJson);
const evaluationDate = "2026-10-19";
const subjectId = "demo-subject";

describe("DEMO_SCENARIOS", () => {
  it("contains eight unique cases", () => {
    expect(DEMO_SCENARIOS).toHaveLength(8);
    expect(new Set(DEMO_SCENARIOS.map((demo) => demo.id)).size).toBe(8);
  });

  it.each(DEMO_SCENARIOS)("matches the real engine: $label", (demo) => {
    const scenario = parseScenario(
      materializeDemoScenario(demo, subjectId),
      policy,
    );

    const result = evaluateDecision({ scenario, policy, evaluationDate });

    expect({ decision: result.decision, reason: result.reason }).toEqual(
      demo.expected,
    );
  });
});
