import { z } from "zod";
import { applyConsentAction } from "@/domain/consent";
import { evaluateDecision } from "@/domain/decision";
import { DomainError, requestNotFound, validationError } from "@/domain/errors";
import { parseScenario } from "@/domain/scenario";
import type { ConsentRequest, DecisionResult, Policy } from "@/domain/types";
import type { ConsentRepository } from "@/repository/consent-repository";

export type CreateRequestResult = {
  request: ConsentRequest;
  created: boolean;
  decision: DecisionResult;
};

const updateRequestSchema = z.strictObject({
  status: z.enum(["approved", "declined"]),
});

export class ConsentService {
  constructor(
    private readonly policy: Policy,
    private readonly repository: ConsentRepository,
    private readonly clock: () => string,
  ) {}

  createRequest(input: unknown): CreateRequestResult {
    const scenario = parseScenario(input, this.policy);
    const evaluationDate = this.clock();

    // Existing-scope lookup happens BEFORE new-request eligibility, so an
    // already approved or declined record is returned unchanged on a retry.
    const existing = this.repository.getByScope(scenario);
    if (existing) {
      return {
        request: existing,
        created: false,
        decision: evaluateDecision({
          scenario,
          policy: this.policy,
          evaluationDate,
          consentStatus: existing.status,
          consentRequestId: existing.id,
        }),
      };
    }

    // The server re-evaluates eligibility; the client cannot claim consent is
    // available. A request is created only for an under-age rule that permits
    // parental consent.
    const eligibility = evaluateDecision({
      scenario,
      policy: this.policy,
      evaluationDate,
      consentStatus: null,
    });

    if (
      eligibility.decision !== "parental_consent" ||
      eligibility.reason !== "parental_consent_required"
    ) {
      throw new DomainError(
        "consent_not_required",
        "current policy does not permit creating a consent request for this scenario",
      );
    }

    // `created` comes from the write itself. A production repository may
    // deduplicate inside `create` (unique constraint), so the earlier lookup
    // cannot prove that this call inserted the row.
    const write = this.repository.create(scenario);

    return {
      request: write.request,
      created: write.created,
      decision: evaluateDecision({
        scenario,
        policy: this.policy,
        evaluationDate,
        consentStatus: write.request.status,
        consentRequestId: write.request.id,
      }),
    };
  }

  updateRequest(id: string, input: unknown): ConsentRequest {
    const parsed = updateRequestSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue.path.length > 0 ? issue.path.join(".") : "status";
      throw validationError(`${path}: ${issue.message}`);
    }

    const current = this.repository.getById(id);
    if (!current) {
      throw requestNotFound(`consent request not found: ${id}`);
    }

    const action = parsed.data.status === "approved" ? "approve" : "decline";
    const transition = applyConsentAction(current.status, action);

    if (!transition.changed) {
      return current;
    }

    return this.repository.updateStatus(id, transition.status);
  }

  listRequests(subjectId: string): ConsentRequest[] {
    const normalized = (subjectId ?? "").trim();
    if (!normalized) {
      throw validationError("subjectId query parameter is required");
    }

    return this.repository.listBySubject(normalized);
  }
}
