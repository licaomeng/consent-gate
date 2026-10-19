import { parseCalendarDate } from "@/domain/age";

const EVALUATION_DATE_ENV = "CONSENT_GATE_EVALUATION_DATE";
const ALLOW_TEST_CLOCK_ENV = "CONSENT_GATE_ALLOW_TEST_CLOCK";

let pinnedEvaluationDate: string | null = null;

/**
 * The environment override exists for deterministic tests. It requires an
 * explicit opt-in so an accidental deployment variable cannot freeze every
 * age in production. A blank value means "unset", never an empty date.
 */
function readTestClockOverride(): string | null {
  if (process.env[ALLOW_TEST_CLOCK_ENV] !== "1") {
    return null;
  }

  const value = (process.env[EVALUATION_DATE_ENV] ?? "").trim();
  return value || null;
}

/**
 * The evaluation date is server-owned. It is never accepted from a request;
 * the in-process setter and the gated environment override exist so tests can
 * pin it without exposing a request field.
 */
export function getEvaluationDate(): string {
  const value =
    pinnedEvaluationDate ??
    readTestClockOverride() ??
    new Date().toISOString().slice(0, 10);

  parseCalendarDate(value, "evaluationDate");
  return value;
}

export function setEvaluationDate(value: string | null): void {
  pinnedEvaluationDate = value;
}

export function resetEvaluationDate(): void {
  pinnedEvaluationDate = null;
}
