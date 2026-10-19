import { parseCalendarDate } from "@/domain/age";

const EVALUATION_DATE_ENV = "CONSENT_GATE_EVALUATION_DATE";

let pinnedEvaluationDate: string | null = null;

/**
 * The evaluation date is server-owned. It is never accepted from a request;
 * `CONSENT_GATE_EVALUATION_DATE` and the in-process setter exist so tests can
 * pin it without exposing a request field.
 */
export function getEvaluationDate(): string {
  const value =
    pinnedEvaluationDate ??
    process.env[EVALUATION_DATE_ENV]?.trim() ??
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
