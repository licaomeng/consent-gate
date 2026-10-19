import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getEvaluationDate,
  resetEvaluationDate,
  setEvaluationDate,
} from "@/server/clock";

const DATE_ENV = "CONSENT_GATE_EVALUATION_DATE";
const ALLOW_ENV = "CONSENT_GATE_ALLOW_TEST_CLOCK";
const originalDate = process.env[DATE_ENV];
const originalAllow = process.env[ALLOW_ENV];

function setEnv(date: string | undefined, allow: string | undefined): void {
  if (date === undefined) {
    delete process.env[DATE_ENV];
  } else {
    process.env[DATE_ENV] = date;
  }

  if (allow === undefined) {
    delete process.env[ALLOW_ENV];
  } else {
    process.env[ALLOW_ENV] = allow;
  }
}

afterEach(() => {
  setEnv(originalDate, originalAllow);
  resetEvaluationDate();
});

describe("getEvaluationDate", () => {
  it("treats a blank override as unset instead of an empty date", () => {
    setEvaluationDate(null);
    setEnv("   ", "1");

    expect(getEvaluationDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("uses the UTC calendar date when no override is set", () => {
    setEvaluationDate(null);
    setEnv(undefined, undefined);
    class UtcOnlyDate extends Date {
      constructor() {
        super("2026-10-19T23:30:00.000Z");
      }
      getFullYear() {
        return 2026;
      }
      getMonth() {
        return 9;
      }
      getDate() {
        return 20;
      }
    }
    vi.stubGlobal("Date", UtcOnlyDate);
    try {
      expect(getEvaluationDate()).toBe("2026-10-19");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("ignores the override unless the test flag is explicitly set", () => {
    setEvaluationDate(null);
    setEnv("1999-01-01", undefined);

    expect(getEvaluationDate()).not.toBe("1999-01-01");
  });

  it("honors the override when the test flag is set", () => {
    setEvaluationDate(null);
    setEnv("1999-01-01", "1");

    expect(getEvaluationDate()).toBe("1999-01-01");
  });

  it("rejects an invalid override only when the test flag is set", () => {
    setEvaluationDate(null);
    setEnv("not-a-date", undefined);
    expect(getEvaluationDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    setEnv("not-a-date", "1");
    expect(() => getEvaluationDate()).toThrow();
  });

  it("keeps the in-process pin above the environment", () => {
    setEvaluationDate("2026-10-19");
    setEnv("1999-01-01", "1");

    expect(getEvaluationDate()).toBe("2026-10-19");
  });
});
