import { requestNotFound } from "./errors";
import type { ConsentAction, ConsentStatus, ConsentTransition } from "./types";

/**
 * Pure consent state machine. `request` is idempotent and reuses an existing
 * record; parent actions may repeat their current value or reverse it.
 */
export function applyConsentAction(
  current: ConsentStatus | null,
  action: ConsentAction,
): ConsentTransition {
  switch (action) {
    case "request":
      return current === null
        ? { status: "pending", changed: true }
        : { status: current, changed: false };

    case "approve":
      if (current === null) {
        throw requestNotFound("no consent request exists for this scope");
      }
      return { status: "approved", changed: current !== "approved" };

    case "decline":
      if (current === null) {
        throw requestNotFound("no consent request exists for this scope");
      }
      return { status: "declined", changed: current !== "declined" };
  }
}
