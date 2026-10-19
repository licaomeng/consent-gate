import { z } from "zod";
import { validationError } from "./errors";
import type { Policy, PolicyRule, UnderAgeAction } from "./types";

const JURISDICTION_PATTERN = /^[A-Z]{2}(-[A-Z0-9]{1,3})?$/;

const policyRuleSchema = z.strictObject({
  jurisdiction: z.string().min(1),
  feature: z.string().min(1),
  min_age: z.number().int().min(0),
  if_under: z.enum(["blocked", "parental_consent"]),
});

const policySchema = z.strictObject({
  features: z.array(z.string().min(1)).min(1),
  rules: z.array(policyRuleSchema),
});

export function isJurisdictionCode(value: string): boolean {
  return JURISDICTION_PATTERN.test(value);
}

/**
 * Client input is trimmed and uppercased, then checked for a jurisdiction code
 * shape. A malformed value is rejected; it never falls through to the `*` rule.
 * A well-formed but unknown code stays valid input.
 */
export function normalizeJurisdiction(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!JURISDICTION_PATTERN.test(normalized)) {
    throw validationError(
      "jurisdiction must be a two-letter country code with an optional subdivision, such as US or US-CA",
    );
  }
  return normalized;
}

export function loadPolicy(input: unknown): Policy {
  const parsed = policySchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? issue.path.join(".") : "policy";
    throw validationError(`${path}: ${issue.message}`);
  }

  const { features, rules } = parsed.data;

  const seenFeatures = new Set<string>();
  for (const feature of features) {
    if (seenFeatures.has(feature)) {
      throw validationError(`duplicate feature in policy: ${feature}`);
    }
    seenFeatures.add(feature);
  }

  const seenRules = new Set<string>();
  const loadedRules: PolicyRule[] = rules.map((rule) => {
    if (rule.jurisdiction !== "*" && !isJurisdictionCode(rule.jurisdiction)) {
      throw validationError(`invalid policy jurisdiction: ${rule.jurisdiction}`);
    }
    if (!seenFeatures.has(rule.feature)) {
      throw validationError(`policy rule references an undeclared feature: ${rule.feature}`);
    }

    const key = `${rule.jurisdiction}\u0000${rule.feature}`;
    if (seenRules.has(key)) {
      throw validationError(
        `duplicate policy rule for ${rule.jurisdiction} + ${rule.feature}`,
      );
    }
    seenRules.add(key);

    return {
      jurisdiction: rule.jurisdiction,
      feature: rule.feature,
      minAge: rule.min_age,
      ifUnder: rule.if_under as UnderAgeAction,
    };
  });

  // Freeze the loaded policy: it becomes a shared singleton in M2, and a
  // downstream mutation of a result must never change later decisions.
  const frozenFeatures = Object.freeze([...features]);
  const frozenRules = Object.freeze(loadedRules.map((rule) => Object.freeze(rule)));

  return Object.freeze({ features: frozenFeatures, rules: frozenRules });
}

export function buildLookupPath(jurisdiction: string): string[] {
  const path = [jurisdiction];
  const separator = jurisdiction.indexOf("-");
  if (separator > 0) {
    path.push(jurisdiction.slice(0, separator));
  }
  path.push("*");
  return path;
}

/**
 * Returns the rules consulted up to and including the winner. File order never
 * determines the winner; only the specificity ladder does.
 */
export function resolveRule(
  policy: Policy,
  feature: string,
  jurisdiction: string,
): { rule: PolicyRule | null; lookupPath: string[] } {
  // Normalize at THIS boundary too. A caller that skips parseScenario must not
  // be able to match a raw `gb` against the wildcard while the `GB` hard block
  // sits unused. Malformed input is rejected, never silently passed through.
  const normalizedJurisdiction = normalizeJurisdiction(jurisdiction);
  const candidates = buildLookupPath(normalizedJurisdiction);
  const lookupPath: string[] = [];

  for (const candidate of candidates) {
    lookupPath.push(candidate);
    const rule = policy.rules.find(
      (entry) => entry.feature === feature && entry.jurisdiction === candidate,
    );
    if (rule) {
      return { rule, lookupPath };
    }
  }

  return { rule: null, lookupPath };
}
