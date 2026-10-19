import { describe, expect, it } from "vitest";
import { calculateAge, parseCalendarDate } from "@/domain/age";
import { DomainError } from "@/domain/errors";

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

describe("parseCalendarDate", () => {
  it("accepts a real calendar date", () => {
    expect(parseCalendarDate("2024-02-29", "dateOfBirth")).toEqual({
      year: 2024,
      month: 2,
      day: 29,
    });
  });

  it("rejects malformed and impossible dates", () => {
    for (const value of ["2023-02-29", "2023-02-30", "2023-13-01", "2023-00-10", "15/03/2015", "2023-1-1"]) {
      expectValidationError(() => parseCalendarDate(value, "dateOfBirth"));
    }
  });
});

describe("calculateAge", () => {
  it("counts the day before, on, and after a birthday", () => {
    expect(calculateAge("2010-06-15", "2026-06-14")).toBe(15);
    expect(calculateAge("2010-06-15", "2026-06-15")).toBe(16);
    expect(calculateAge("2010-06-15", "2026-06-16")).toBe(16);
  });

  it("returns zero on the day of birth", () => {
    expect(calculateAge("2026-10-19", "2026-10-19")).toBe(0);
  });

  it("moves a February 29 birthday to March 1 in a non-leap year", () => {
    expect(calculateAge("2000-02-29", "2021-02-28")).toBe(20);
    expect(calculateAge("2000-02-29", "2021-03-01")).toBe(21);
    expect(calculateAge("2000-02-29", "2024-02-29")).toBe(24);
  });

  it("rejects a future date of birth", () => {
    expectValidationError(() => calculateAge("2026-10-20", "2026-10-19"));
  });

  it("rejects an invalid evaluation date", () => {
    expectValidationError(() => calculateAge("2010-06-15", "2026-02-30"));
  });
});
