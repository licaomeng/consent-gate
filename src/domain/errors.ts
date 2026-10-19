export type ErrorCode =
  | "validation_error"
  | "request_not_found"
  | "consent_not_required"
  | "dependency_unavailable"
  | "payload_too_large";

export class DomainError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

export function validationError(message: string): DomainError {
  return new DomainError("validation_error", message);
}

export function requestNotFound(message: string): DomainError {
  return new DomainError("request_not_found", message);
}

export function payloadTooLarge(): DomainError {
  return new DomainError("payload_too_large", "request body exceeds the 8 KiB limit");
}
