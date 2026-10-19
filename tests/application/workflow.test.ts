import { describe, expect, it } from "vitest";
import {
  actionsFor,
  findRequestForScenario,
  isStale,
} from "@/application/workflow";
import type {
  ConsentRequest,
  DecisionResult,
  Scenario,
} from "@/domain/types";

function decision(value: DecisionResult["decision"]): DecisionResult {
  const reason =
    value === "allowed"
      ? "meets_minimum_age"
      : value === "blocked"
        ? "under_minimum_age"
        : "parental_consent_required";

  return {
    decision: value,
    reason,
    age: 11,
    evaluatedAt: "2026-10-19",
    lookupPath: ["DE"],
    matchedRule: null,
  };
}

function request(status: ConsentRequest["status"]): ConsentRequest {
  return {
    id: "request-1",
    subjectId: "subject-1",
    jurisdiction: "DE",
    feature: "chat",
    status,
    createdAt: "2026-10-19T00:00:00.000Z",
    updatedAt: "2026-10-19T00:00:00.000Z",
  };
}

describe("actionsFor", () => {
  it("offers Ask a parent only for parental_consent with no request", () => {
    expect(actionsFor(decision("parental_consent"), null).canAskParent).toBe(true);
    expect(actionsFor(decision("blocked"), null).canAskParent).toBe(false);
    expect(actionsFor(decision("allowed"), null).canAskParent).toBe(false);
    expect(
      actionsFor(decision("parental_consent"), request("pending")).canAskParent,
    ).toBe(false);
  });

  it("does not offer Ask again when the server says a request is pending", () => {
    const pendingDecision: DecisionResult = {
      ...decision("parental_consent"),
      reason: "parental_consent_pending",
    };

    expect(actionsFor(pendingDecision, null).canAskParent).toBe(false);
  });

  it("derives approve/decline from the current status", () => {
    expect(actionsFor(decision("parental_consent"), request("pending"))).toMatchObject({
      canApprove: true,
      canDecline: true,
    });
    expect(actionsFor(decision("parental_consent"), request("approved"))).toMatchObject({
      canApprove: false,
      canDecline: true,
    });
    expect(actionsFor(decision("parental_consent"), request("declined"))).toMatchObject({
      canApprove: true,
      canDecline: false,
    });
  });

  it("exposes no parent actions without a request", () => {
    expect(actionsFor(decision("parental_consent"), null)).toMatchObject({
      canApprove: false,
      canDecline: false,
    });
  });
});

describe("isStale", () => {
  it("rejects a response whose token is no longer current", () => {
    expect(isStale(2, 1)).toBe(true);
    expect(isStale(2, 2)).toBe(false);
  });
});

describe("findRequestForScenario", () => {
  const scenario: Scenario = {
    subjectId: "subject-1",
    dateOfBirth: "2015-03-01",
    jurisdiction: "DE",
    feature: "chat",
  };

  it("matches the exact subject, jurisdiction, and feature", () => {
    const match = request("pending");
    const otherSubject = { ...request("pending"), id: "other-subject", subjectId: "subject-2" };
    const otherFeature = { ...request("pending"), id: "other-feature", feature: "purchases" };

    expect(
      findRequestForScenario([otherSubject, otherFeature, match], scenario)?.id,
    ).toBe("request-1");
  });

  it("returns null when no request matches", () => {
    expect(
      findRequestForScenario(
        [{ ...request("pending"), feature: "purchases" }],
        scenario,
      ),
    ).toBeNull();
  });
});
