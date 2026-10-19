import { z } from "zod";
import { parseCalendarDate } from "./age";
import { validationError } from "./errors";
import { normalizeJurisdiction } from "./policy";
import type { Policy, Scenario } from "./types";

const scenarioSchema = z.strictObject({
  subjectId: z.string().trim().min(1).max(128),
  dateOfBirth: z.string().min(1).max(32),
  jurisdiction: z.string().min(1).max(16),
  feature: z.string().min(1).max(64),
});

/**
 * Strict request-shape validation. Unknown keys, including a client-supplied
 * evaluationDate, are rejected rather than ignored.
 */
export function parseScenario(input: unknown, policy: Policy): Scenario {
  const parsed = scenarioSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? issue.path.join(".") : "scenario";
    throw validationError(`${path}: ${issue.message}`);
  }

  const value = parsed.data;
  parseCalendarDate(value.dateOfBirth, "dateOfBirth");

  const jurisdiction = normalizeJurisdiction(value.jurisdiction);

  if (!policy.features.includes(value.feature)) {
    throw validationError(
      `feature must be one of: ${policy.features.join(", ")}`,
    );
  }

  return {
    subjectId: value.subjectId,
    dateOfBirth: value.dateOfBirth,
    jurisdiction,
    feature: value.feature,
  };
}
