import { afterEach, describe, expect, it } from "vitest";
import { resetEvaluationDate, setEvaluationDate } from "@/server/clock";
import {
  createContainer,
  getContainer,
  resetContainer,
  setContainer,
} from "@/server/container";

const originalDate = process.env.CONSENT_GATE_EVALUATION_DATE;
const originalAllow = process.env.CONSENT_GATE_ALLOW_TEST_CLOCK;

afterEach(() => {
  if (originalDate === undefined) {
    delete process.env.CONSENT_GATE_EVALUATION_DATE;
  } else {
    process.env.CONSENT_GATE_EVALUATION_DATE = originalDate;
  }

  if (originalAllow === undefined) {
    delete process.env.CONSENT_GATE_ALLOW_TEST_CLOCK;
  } else {
    process.env.CONSENT_GATE_ALLOW_TEST_CLOCK = originalAllow;
  }

  resetEvaluationDate();
  resetContainer();
});

describe("createContainer", () => {
  it("validates the evaluation date at construction time", () => {
    // A bad server clock must stop startup, not become a 400 on the first
    // request. The container calls getEvaluationDate() eagerly for this reason.
    setEvaluationDate(null);
    process.env.CONSENT_GATE_ALLOW_TEST_CLOCK = "1";
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

describe("getContainer", () => {
  it("returns a stable singleton and supports replacement", () => {
    // globalThis storage keeps the in-memory consent state alive across
    // Next.js module reloads during development.
    const first = getContainer();
    expect(getContainer()).toBe(first);

    const replacement = createContainer();
    setContainer(replacement);
    expect(getContainer()).toBe(replacement);

    resetContainer();
    expect(getContainer()).not.toBe(replacement);
  });
});
