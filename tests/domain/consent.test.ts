import { describe, expect, it } from "vitest";
import { applyConsentAction } from "@/domain/consent";
import { DomainError } from "@/domain/errors";
import type { ConsentStatus } from "@/domain/types";

function expectRequestNotFound(run: () => unknown): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe("request_not_found");
    return;
  }
  throw new Error("expected a request_not_found error");
}

describe("applyConsentAction", () => {
  it("creates a pending request from no state", () => {
    expect(applyConsentAction(null, "request")).toEqual({
      status: "pending",
      changed: true,
    });
  });

  it.each<ConsentStatus>(["pending", "approved", "declined"])(
    "reuses the existing %s request on a repeated create",
    (status) => {
      expect(applyConsentAction(status, "request")).toEqual({ status, changed: false });
    },
  );

  it("rejects a parent action when no request exists", () => {
    expectRequestNotFound(() => applyConsentAction(null, "approve"));
    expectRequestNotFound(() => applyConsentAction(null, "decline"));
  });

  it("moves pending to approved or declined", () => {
    expect(applyConsentAction("pending", "approve")).toEqual({
      status: "approved",
      changed: true,
    });
    expect(applyConsentAction("pending", "decline")).toEqual({
      status: "declined",
      changed: true,
    });
  });

  it("treats a repeated parent action as an idempotent no-op", () => {
    expect(applyConsentAction("approved", "approve")).toEqual({
      status: "approved",
      changed: false,
    });
    expect(applyConsentAction("declined", "decline")).toEqual({
      status: "declined",
      changed: false,
    });
  });

  it("allows a parent to reverse a resolved decision", () => {
    expect(applyConsentAction("approved", "decline")).toEqual({
      status: "declined",
      changed: true,
    });
    expect(applyConsentAction("declined", "approve")).toEqual({
      status: "approved",
      changed: true,
    });
  });
});
