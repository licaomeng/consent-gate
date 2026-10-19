import { afterEach, describe, expect, it, vi } from "vitest";
import { DomainError, validationError } from "@/domain/errors";
import { errorResponse, readJson } from "@/http/responses";
import { RepositoryError } from "@/repository/consent-repository";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("errorResponse", () => {
  it.each([
    ["validation_error", 400],
    ["request_not_found", 404],
    ["consent_not_required", 409],
    ["dependency_unavailable", 503],
  ] as const)("maps %s to %d", (code, status) => {
    const response = errorResponse(new DomainError(code, "message"));

    expect(response.status).toBe(status);
  });

  it("does not log expected domain errors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    errorResponse(new DomainError("validation_error", "bad input"));
    errorResponse(new DomainError("request_not_found", "missing"));

    expect(spy).not.toHaveBeenCalled();
  });

  it("maps a repository failure to 503 and logs it for operators", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = errorResponse(new RepositoryError("storage unavailable"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("dependency_unavailable");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("does not leak an unexpected error but logs it for operators", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = errorResponse(new Error("secret internal detail"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("internal_error");
    expect(JSON.stringify(body)).not.toContain("secret internal detail");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("readJson", () => {
  it("rejects malformed JSON with the validation contract", async () => {
    const request = new Request("http://localhost/api/v1/decisions", {
      method: "POST",
      body: "{",
      headers: { "content-type": "application/json" },
    });

    await expect(readJson(request)).rejects.toMatchObject({
      code: validationError("x").code,
    });
  });
});
