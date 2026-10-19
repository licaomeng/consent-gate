import { type DomainError, validationError } from "@/domain/errors";
import type { RepositoryError } from "@/repository/consent-repository";

const STATUS_BY_DOMAIN_ERROR: Record<DomainError["code"], number> = {
  validation_error: 400,
  request_not_found: 404,
  consent_not_required: 409,
  dependency_unavailable: 503,
};

const DOMAIN_ERROR_CODES = new Set<DomainError["code"]>(
  Object.keys(STATUS_BY_DOMAIN_ERROR) as DomainError["code"][],
);

/**
 * Do not use `instanceof` here. The production server bundles the route
 * handler and the services separately, so the same error class can exist as
 * two different constructors; `instanceof` then fails and a 409/400 becomes a
 * 500. The class name and the closed set of codes are stable across bundles.
 */
function isDomainError(error: unknown): error is DomainError {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { name?: unknown; code?: unknown };
  return (
    candidate.name === "DomainError" &&
    typeof candidate.code === "string" &&
    DOMAIN_ERROR_CODES.has(candidate.code as DomainError["code"])
  );
}

function isRepositoryError(error: unknown): error is RepositoryError {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "RepositoryError"
  );
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw validationError("request body must be valid JSON");
  }
}

export function errorResponse(error: unknown): Response {
  if (isDomainError(error)) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: STATUS_BY_DOMAIN_ERROR[error.code] },
    );
  }

  if (isRepositoryError(error)) {
    // The client gets a stable contract; operators still need the cause.
    console.error("[consent-gate] storage failure", error);
    return Response.json(
      {
        error: {
          code: "dependency_unavailable",
          message: "consent state is unavailable",
        },
      },
      { status: 503 },
    );
  }

  console.error("[consent-gate] unexpected error", error);
  return Response.json(
    { error: { code: "internal_error", message: "unexpected error" } },
    { status: 500 },
  );
}
