import { describe, expect, it } from "vitest";
import briefPolicyJson from "@/data/policy.json";
import { DomainError } from "@/domain/errors";
import {
  buildLookupPath,
  loadPolicy,
  normalizeJurisdiction,
  resolveRule,
} from "@/domain/policy";

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

describe("loadPolicy", () => {
  it("loads the supplied policy and maps snake_case to the domain shape", () => {
    const policy = loadPolicy(briefPolicyJson);

    expect(policy.features).toEqual(["chat", "purchases", "profile_photo", "video_upload"]);
    expect(policy.rules).toHaveLength(9);
    expect(policy.rules[3]).toEqual({
      jurisdiction: "US-CA",
      feature: "chat",
      minAge: 16,
      ifUnder: "parental_consent",
    });
  });

  it("rejects duplicate jurisdiction + feature keys", () => {
    const duplicate = {
      ...briefPolicyJson,
      rules: [
        ...briefPolicyJson.rules,
        { jurisdiction: "DE", feature: "chat", min_age: 16, if_under: "parental_consent" },
      ],
    };

    expectValidationError(() => loadPolicy(duplicate));
  });

  it("rejects an unknown under-age action", () => {
    const invalid = {
      ...briefPolicyJson,
      rules: [{ jurisdiction: "US", feature: "chat", min_age: 13, if_under: "allow" }],
    };

    expectValidationError(() => loadPolicy(invalid));
  });

  it("rejects negative and fractional ages", () => {
    const negative = {
      ...briefPolicyJson,
      rules: [{ jurisdiction: "US", feature: "chat", min_age: -1, if_under: "blocked" }],
    };
    const fractional = {
      ...briefPolicyJson,
      rules: [{ jurisdiction: "US", feature: "chat", min_age: 13.5, if_under: "blocked" }],
    };

    expectValidationError(() => loadPolicy(negative));
    expectValidationError(() => loadPolicy(fractional));
  });

  it("rejects a rule for an undeclared feature", () => {
    const invalid = {
      ...briefPolicyJson,
      rules: [{ jurisdiction: "US", feature: "teleport", min_age: 13, if_under: "blocked" }],
    };

    expectValidationError(() => loadPolicy(invalid));
  });

  it("rejects duplicate declared features", () => {
    const invalid = {
      ...briefPolicyJson,
      features: ["chat", "chat", "purchases"],
    };

    expectValidationError(() => loadPolicy(invalid));
  });

  it("rejects lowercase policy jurisdictions instead of silently correcting them", () => {
    const invalid = {
      ...briefPolicyJson,
      rules: [{ jurisdiction: "us-ca", feature: "chat", min_age: 16, if_under: "blocked" }],
    };

    expectValidationError(() => loadPolicy(invalid));
  });

  it("rejects unknown fields in the policy file", () => {
    const invalid = { ...briefPolicyJson, version: 2 };

    expectValidationError(() => loadPolicy(invalid));
  });

  it("freezes the loaded policy so a shared singleton cannot be mutated", () => {
    const policy = loadPolicy(briefPolicyJson);

    expect(Object.isFrozen(policy)).toBe(true);
    expect(Object.isFrozen(policy.features)).toBe(true);
    expect(Object.isFrozen(policy.rules)).toBe(true);
    expect(policy.rules.every((rule) => Object.isFrozen(rule))).toBe(true);
    expect(() => {
      (policy.rules[0] as unknown as { minAge: number }).minAge = 0;
    }).toThrow(TypeError);
  });
});

describe("normalizeJurisdiction", () => {
  it("trims and uppercases a well-formed code", () => {
    expect(normalizeJurisdiction(" us-ca ")).toBe("US-CA");
    expect(normalizeJurisdiction("gb")).toBe("GB");
  });

  it("rejects malformed codes", () => {
    for (const value of ["", "   ", "g!", "USA", "*", "U", "U1", "US-", "US-CALIFORNIA"]) {
      expectValidationError(() => normalizeJurisdiction(value));
    }
  });
});

describe("rule resolution", () => {
  const policy = loadPolicy(briefPolicyJson);

  it("builds the specificity ladder", () => {
    expect(buildLookupPath("US-CA")).toEqual(["US-CA", "US", "*"]);
    expect(buildLookupPath("DE")).toEqual(["DE", "*"]);
  });

  it("prefers the exact subdivision over country and wildcard", () => {
    const result = resolveRule(policy, "chat", "US-CA");

    expect(result.rule?.jurisdiction).toBe("US-CA");
    expect(result.rule?.minAge).toBe(16);
    expect(result.lookupPath).toEqual(["US-CA"]);
  });

  it("matches the country directly when the jurisdiction has no subdivision", () => {
    const result = resolveRule(policy, "chat", "US");

    expect(result.rule?.jurisdiction).toBe("US");
    expect(result.lookupPath).toEqual(["US"]);
  });

  it("falls back from an unlisted subdivision to its country", () => {
    const result = resolveRule(policy, "chat", "US-NY");

    expect(result.rule?.jurisdiction).toBe("US");
    expect(result.lookupPath).toEqual(["US-NY", "US"]);
  });

  it("falls back to the wildcard when no specific rule exists", () => {
    const result = resolveRule(policy, "profile_photo", "DE");

    expect(result.rule?.jurisdiction).toBe("*");
    expect(result.lookupPath).toEqual(["DE", "*"]);
  });

  it("returns no rule and the full ladder for a coverage gap", () => {
    const result = resolveRule(policy, "purchases", "ZZ");

    expect(result.rule).toBeNull();
    expect(result.lookupPath).toEqual(["ZZ", "*"]);
  });

  it("normalizes the jurisdiction at the resolution boundary", () => {
    // A caller that skips parseScenario must still hit the GB hard block, not
    // fall through to the wildcard consent rule.
    const result = resolveRule(policy, "chat", "gb");

    expect(result.rule?.jurisdiction).toBe("GB");
    expect(result.rule?.ifUnder).toBe("blocked");
    expect(result.lookupPath).toEqual(["GB"]);
  });

  it("rejects a malformed jurisdiction at the resolution boundary", () => {
    expectValidationError(() => resolveRule(policy, "chat", "g!"));
  });

  it("does not depend on file order", () => {
    const reversed = loadPolicy({
      ...briefPolicyJson,
      rules: [...briefPolicyJson.rules].reverse(),
    });

    expect(resolveRule(reversed, "chat", "US-CA")).toEqual(
      resolveRule(policy, "chat", "US-CA"),
    );
  });
});
