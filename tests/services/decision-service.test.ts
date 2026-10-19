import { describe, expect, it } from "vitest";
import { DomainError } from "@/domain/errors";
import { RepositoryError, type ConsentRepository } from "@/repository/consent-repository";
import {
  EVALUATION_DATE,
  childChat,
  hardBlockedChildChat,
  makeServices,
} from "../support/harness";

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

describe("DecisionService.checkAccess", () => {
  it("returns a decision without creating any state", () => {
    const { decisionService, repository } = makeServices();

    const result = decisionService.checkAccess(childChat);

    expect(result.decision).toBe("parental_consent");
    expect(result.reason).toBe("parental_consent_required");
    expect(result.evaluatedAt).toBe(EVALUATION_DATE);
    expect(repository.listBySubject(childChat.subjectId)).toEqual([]);
  });

  it("reads the current consent state without mutating it", () => {
    const { consentService, decisionService, repository } = makeServices();
    const created = consentService.createRequest(childChat);

    const pending = decisionService.checkAccess(childChat);
    expect(pending.reason).toBe("parental_consent_pending");
    expect(pending.consentRequestId).toBe(created.request.id);

    consentService.updateRequest(created.request.id, { status: "approved" });
    const approved = decisionService.checkAccess(childChat);

    expect(approved.decision).toBe("allowed");
    expect(approved.reason).toBe("parental_consent_approved");
    expect(repository.listBySubject(childChat.subjectId)).toHaveLength(1);
  });

  it("keeps a hard block even when an approval exists in the same scope", () => {
    const { decisionService, repository } = makeServices();

    // Seed the hard-block scope directly: the service correctly refuses to
    // create it, but an old record must never unlock a hard block.
    const { request } = repository.create({
      subjectId: hardBlockedChildChat.subjectId,
      jurisdiction: "GB",
      feature: "chat",
    });
    repository.updateStatus(request.id, "approved");

    const blocked = decisionService.checkAccess(hardBlockedChildChat);

    expect(blocked.decision).toBe("blocked");
    expect(blocked.reason).toBe("under_minimum_age");
    expect(blocked.matchedRule?.jurisdiction).toBe("GB");
  });

  it("rejects an undeclared feature", () => {
    const { decisionService } = makeServices();

    expect(() =>
      decisionService.checkAccess({ ...childChat, feature: "teleport" }),
    ).toThrowError(DomainError);
  });

  it("propagates repository failures instead of inventing a decision", () => {
    const { decisionService } = makeServices({ repository: failingRepository() });

    expect(() => decisionService.checkAccess(childChat)).toThrowError(RepositoryError);
  });
});
