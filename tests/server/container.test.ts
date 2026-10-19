import { afterEach, describe, expect, it } from "vitest";
import { resetEvaluationDate, setEvaluationDate } from "@/server/clock";
import { createContainer } from "@/server/container";

const originalEnv = process.env.CONSENT_GATE_EVALUATION_DATE;

afterEach(() => {
  if (originalEnv === undefined) {
    delete process.env.CONSENT_GATE_EVALUATION_DATE;
  } else {
    process.env.CONSENT_GATE_EVALUATION_DATE = originalEnv;
  }
  resetEvaluationDate();
});

describe("createContainer", () => {
  it("validates the evaluation date at construction time", () => {
    // A bad server clock must stop startup, not become a 400 on the first
    // request. The container calls getEvaluationDate() eagerly for this reason.
    setEvaluationDate(null);
    process.env.CONSENT_GATE_EVALUATION_DATE = "not-a-date";

    expect(() => createContainer()).toThrow();
  });

  it("builds the policy and both services", () => {
    setEvaluationDate("2026-10-19");

    const container = createContainer();

    expect(container.policy.rules.length).toBeGreaterThan(0);
    expect(container.decisionService).toBeDefined();
    expect(container.consentService).toBeDefined();
  });
});
