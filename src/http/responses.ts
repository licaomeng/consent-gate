import { DomainError, validationError } from "@/domain/errors";
import { RepositoryError } from "@/repository/consent-repository";

const STATUS_BY_DOMAIN_ERROR: Record<DomainError["code"], number> = {
  validation_error: 400,
  request_not_found: 404,
  consent_not_required: 409,
  dependency_unavailable: 503,
};

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw validationError("request body must be valid JSON");
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof DomainError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: STATUS_BY_DOMAIN_ERROR[error.code] },
    );
  }

  if (error instanceof RepositoryError) {
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
