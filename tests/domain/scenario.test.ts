import { describe, expect, it } from "vitest";
import briefPolicyJson from "@/data/policy.json";
import { DomainError } from "@/domain/errors";
import { loadPolicy } from "@/domain/policy";
import { parseScenario } from "@/domain/scenario";

const policy = loadPolicy(briefPolicyJson);

const validScenario = {
  subjectId: "subject-1",
  dateOfBirth: "2015-03-01",
  jurisdiction: "DE",
  feature: "chat",
};

function expectValidationError(run: () => unknown): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe("validation_error");
    return;
  }
  throw new Error("expected a validation error");
}

describe("parseScenario", () => {
  it("trims the subject id and normalizes the jurisdiction", () => {
    const scenario = parseScenario(
      { ...validScenario, subjectId: "  subject-1  ", jurisdiction: " de " },
      policy,
    );

    expect(scenario).toEqual({
      subjectId: "subject-1",
      dateOfBirth: "2015-03-01",
      jurisdiction: "DE",
      feature: "chat",
    });
  });

  it("accepts a lowercase subdivision", () => {
    const scenario = parseScenario({ ...validScenario, jurisdiction: "us-ca" }, policy);

    expect(scenario.jurisdiction).toBe("US-CA");
  });

  it("rejects a client-supplied evaluation date instead of ignoring it", () => {
    expectValidationError(() =>
      parseScenario({ ...validScenario, evaluationDate: "2040-01-01" }, policy),
    );
  });

  it("rejects malformed jurisdictions", () => {
    for (const jurisdiction of ["", "g!", "USA", "*", "US-CALIFORNIA"]) {
      expectValidationError(() => parseScenario({ ...validScenario, jurisdiction }, policy));
    }
  });

  it("rejects an undeclared feature", () => {
    expectValidationError(() =>
      parseScenario({ ...validScenario, feature: "teleport" }, policy),
    );
  });

  it("rejects an invalid or missing date of birth", () => {
    expectValidationError(() =>
      parseScenario({ ...validScenario, dateOfBirth: "2015-02-30" }, policy),
    );
    expectValidationError(() =>
      parseScenario({ ...validScenario, dateOfBirth: "0000-01-01" }, policy),
    );

    const { dateOfBirth: _omitted, ...withoutDate } = validScenario;
    expectValidationError(() => parseScenario(withoutDate, policy));
  });

  it("rejects an empty subject id", () => {
    expectValidationError(() =>
      parseScenario({ ...validScenario, subjectId: "   " }, policy),
    );
  });

  it("rejects non-string fields", () => {
    expectValidationError(() =>
      parseScenario({ ...validScenario, feature: 42 }, policy),
    );
  });
});
