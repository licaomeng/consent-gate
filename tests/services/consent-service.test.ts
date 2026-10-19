import { describe, expect, it } from "vitest";
import { DomainError } from "@/domain/errors";
import { loadPolicy } from "@/domain/policy";
import type { ConsentRequest } from "@/domain/types";
import {
  InMemoryConsentRepository,
  RepositoryError,
  type ConsentRepository,
} from "@/repository/consent-repository";
import {
  adultPurchase,
  childChat,
  hardBlockedChildChat,
  makeServices,
} from "../support/harness";

function errorCode(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    return (error as DomainError).code;
  }
  throw new Error("expected a DomainError");
}

function failingRepository(): ConsentRepository {
  const fail = () => {
    throw new RepositoryError("storage unavailable");
  };

  return {
    getByScope: fail,
    getById: fail,
    listBySubject: fail,
    create: fail,
    updateStatus: fail,
  };
}

describe("ConsentService.createRequest", () => {
  it("creates a pending request for an eligible under-age scenario", () => {
    const { consentService } = makeServices();

    const result = consentService.createRequest(childChat);

    expect(result.created).toBe(true);
    expect(result.request.status).toBe("pending");
    expect(result.request.jurisdiction).toBe("DE");
    expect(result.decision.reason).toBe("parental_consent_pending");
    expect(result.decision.consentRequestId).toBe(result.request.id);
  });

  it("reuses an existing request instead of opening a second lifecycle", () => {
    const { consentService } = makeServices();
    const first = consentService.createRequest(childChat);
    const second = consentService.createRequest(childChat);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.request.id).toBe(first.request.id);
  });

  it("returns an existing record before re-evaluating eligibility under a changed policy", () => {
    // DECISIONS: existing-scope lookup happens BEFORE new-request eligibility.
    // A record created while consent was permitted must still be returned after
    // the policy changes that scope into a hard block.
    const repository = new InMemoryConsentRepository();
    const consentPolicy = loadPolicy({
      features: ["chat"],
      rules: [
        { jurisdiction: "DE", feature: "chat", min_age: 16, if_under: "parental_consent" },
      ],
    });
    const blockedPolicy = loadPolicy({
      features: ["chat"],
      rules: [{ jurisdiction: "DE", feature: "chat", min_age: 16, if_under: "blocked" }],
    });

    const created = makeServices({ repository, policy: consentPolicy }).consentService
      .createRequest(childChat);
    const retried = makeServices({ repository, policy: blockedPolicy }).consentService
      .createRequest(childChat);

    expect(retried.created).toBe(false);
    expect(retried.request.id).toBe(created.request.id);
    expect(retried.request.status).toBe("pending");
    expect(retried.decision.decision).toBe("blocked");
  });

  it("returns an already approved record unchanged on a retry", () => {
    const { consentService } = makeServices();
    const created = consentService.createRequest(childChat);
    consentService.updateRequest(created.request.id, { status: "approved" });

    const retry = consentService.createRequest(childChat);

    expect(retry.created).toBe(false);
    expect(retry.request.status).toBe("approved");
    expect(retry.decision.decision).toBe("allowed");
    expect(retry.decision.reason).toBe("parental_consent_approved");
  });

  it("normalizes the jurisdiction before storing the scope", () => {
    const { consentService } = makeServices();

    const result = consentService.createRequest({ ...childChat, jurisdiction: " de " });

    expect(result.request.jurisdiction).toBe("DE");
  });

  it("rejects a hard block, an adult, and a coverage gap", () => {
    const { consentService } = makeServices();

    expect(errorCode(() => consentService.createRequest(hardBlockedChildChat))).toBe(
      "consent_not_required",
    );
    expect(errorCode(() => consentService.createRequest(adultPurchase))).toBe(
      "consent_not_required",
    );
    expect(
      errorCode(() =>
        consentService.createRequest({
          subjectId: "child-1",
          dateOfBirth: "2015-03-01",
          jurisdiction: "ZZ",
          feature: "purchases",
        }),
      ),
    ).toBe("consent_not_required");
  });

  it("rejects a client-supplied evaluation date", () => {
    const { consentService } = makeServices();

    expect(
      errorCode(() =>
        consentService.createRequest({ ...childChat, evaluationDate: "2040-01-01" }),
      ),
    ).toBe("validation_error");
  });

  it("isolates consent by subject, jurisdiction, and feature", () => {
    const { consentService } = makeServices();

    const deChat = consentService.createRequest(childChat);
    const usPurchase = consentService.createRequest({
      subjectId: "child-1",
      dateOfBirth: "2015-03-01",
      jurisdiction: "US",
      feature: "purchases",
    });
    const otherChild = consentService.createRequest({
      ...childChat,
      subjectId: "child-2",
    });

    expect(new Set([deChat.request.id, usPurchase.request.id, otherChild.request.id]).size).toBe(3);
  });

  it("uses the repository's write result for the created flag", () => {
    // Simulate a race: the pre-write lookup sees nothing, but the write
    // deduplicates and returns an existing record. The response must say
    // created:false, not claim a 201 for a row it did not insert.
    const existing: ConsentRequest = {
      id: "existing-1",
      subjectId: childChat.subjectId,
      jurisdiction: "DE",
      feature: "chat",
      status: "approved",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const repository: ConsentRepository = {
      getByScope: () => null,
      getById: () => existing,
      listBySubject: () => [existing],
      create: () => ({ request: existing, created: false }),
      updateStatus: () => existing,
    };
    const { consentService } = makeServices({ repository });

    const result = consentService.createRequest(childChat);

    expect(result.created).toBe(false);
    expect(result.request.id).toBe("existing-1");
    expect(result.decision.reason).toBe("parental_consent_approved");
  });

  it("propagates repository failures", () => {
    const { consentService } = makeServices({ repository: failingRepository() });

    expect(() => consentService.createRequest(childChat)).toThrowError(RepositoryError);
  });

  it("propagates a failure from the create write", () => {
    const repository: ConsentRepository = {
      getByScope: () => null,
      getById: () => null,
      listBySubject: () => [],
      create: () => {
        throw new RepositoryError("write failed");
      },
      updateStatus: () => {
        throw new RepositoryError("write failed");
      },
    };
    const { consentService } = makeServices({ repository });

    expect(() => consentService.createRequest(childChat)).toThrowError(RepositoryError);
  });
});

describe("ConsentService.updateRequest", () => {
  it("approves, declines, and reverses", () => {
    const { consentService } = makeServices();
    const created = consentService.createRequest(childChat);

    expect(consentService.updateRequest(created.request.id, { status: "approved" }).status).toBe(
      "approved",
    );
    expect(consentService.updateRequest(created.request.id, { status: "declined" }).status).toBe(
      "declined",
    );
    expect(consentService.updateRequest(created.request.id, { status: "approved" }).status).toBe(
      "approved",
    );
  });

  it("treats a repeated parent action as an idempotent no-op", () => {
    const { consentService } = makeServices();
    const created = consentService.createRequest(childChat);
    const first = consentService.updateRequest(created.request.id, { status: "approved" });
    const second = consentService.updateRequest(created.request.id, { status: "approved" });

    expect(second.status).toBe("approved");
    expect(second.updatedAt).toBe(first.updatedAt);
  });

  it("returns request_not_found for an unknown id", () => {
    const { consentService } = makeServices();

    expect(errorCode(() => consentService.updateRequest("missing", { status: "approved" }))).toBe(
      "request_not_found",
    );
  });

  it("propagates a failure from the status write", () => {
    const pending: ConsentRequest = {
      id: "pending-1",
      subjectId: childChat.subjectId,
      jurisdiction: "DE",
      feature: "chat",
      status: "pending",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const repository: ConsentRepository = {
      getByScope: () => pending,
      getById: () => pending,
      listBySubject: () => [pending],
      create: () => ({ request: pending, created: false }),
      updateStatus: () => {
        throw new RepositoryError("write failed");
      },
    };
    const { consentService } = makeServices({ repository });

    expect(() =>
      consentService.updateRequest(pending.id, { status: "approved" }),
    ).toThrowError(RepositoryError);
  });

  it("rejects an invalid or extra field", () => {
    const { consentService } = makeServices();
    const created = consentService.createRequest(childChat);

    expect(
      errorCode(() => consentService.updateRequest(created.request.id, { status: "pending" })),
    ).toBe("validation_error");
    expect(
      errorCode(() =>
        consentService.updateRequest(created.request.id, {
          status: "approved",
          extra: true,
        }),
      ),
    ).toBe("validation_error");
  });
});

describe("ConsentService.listRequests", () => {
  it("returns only the requested subject's records", () => {
    const { consentService } = makeServices();
    consentService.createRequest(childChat);
    consentService.createRequest({ ...childChat, subjectId: "child-2" });

    const requests = consentService.listRequests(childChat.subjectId);

    expect(requests).toHaveLength(1);
    expect(requests[0].subjectId).toBe(childChat.subjectId);
  });

  it("rejects a missing subject id", () => {
    const { consentService } = makeServices();

    expect(errorCode(() => consentService.listRequests("   "))).toBe("validation_error");
  });
});
