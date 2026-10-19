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
    ["payload_too_large", 413],
  ] as const)("maps %s to %d", (code, status) => {
    const response = errorResponse(new DomainError(code, "message"));

    expect(response.status).toBe(status);
  });

  it("recognises a DomainError from another bundle by its stable shape", async () => {
    const response = errorResponse({
      name: "DomainError",
      code: "validation_error",
      message: "bad input",
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("validation_error");
  });

  it("recognises a RepositoryError from another bundle by its stable shape", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = errorResponse({
      name: "RepositoryError",
      message: "storage unavailable",
    });

    expect(response.status).toBe(503);
  });

  it("does not classify a primitive or null as a domain error", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(errorResponse("boom").status).toBe(500);
    expect(errorResponse(null).status).toBe(500);
  });

  it("does not classify an unknown error code as a domain error", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = errorResponse({
      name: "DomainError",
      code: "not_a_real_code",
      message: "forged",
    });

    expect(response.status).toBe(500);
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
  it("rejects a missing body with the validation contract", async () => {
    const request = new Request("http://localhost/api/v1/decisions", {
      method: "POST",
    });

    await expect(readJson(request)).rejects.toMatchObject({
      code: "validation_error",
    });
  });

  it("rejects a declared content-length over the limit before reading", async () => {
    const request = new Request("http://localhost/api/v1/decisions", {
      method: "POST",
      body: "{}",
      headers: {
        "content-type": "application/json",
        "content-length": "9000",
      },
    });

    await expect(readJson(request)).rejects.toMatchObject({
      code: "payload_too_large",
    });
  });

  it("rejects a streamed body over the limit without a content-length header", async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("x".repeat(9000)));
        controller.close();
      },
    });
    const request = new Request("http://localhost/api/v1/decisions", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit);

    await expect(readJson(request)).rejects.toMatchObject({
      code: "payload_too_large",
    });
  });

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
