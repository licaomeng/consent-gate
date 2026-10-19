import policyJson from "@/data/policy.json";
import { loadPolicy } from "@/domain/policy";
import type { Policy } from "@/domain/types";
import {
  InMemoryConsentRepository,
  type ConsentRepository,
} from "@/repository/consent-repository";
import { ConsentService } from "@/services/consent-service";
import { DecisionService } from "@/services/decision-service";

export const EVALUATION_DATE = "2026-10-19";

export function makeServices(
  options: {
    repository?: ConsentRepository;
    evaluationDate?: string;
    policy?: Policy;
  } = {},
) {
  const policy = options.policy ?? loadPolicy(policyJson);
  const repository = options.repository ?? new InMemoryConsentRepository();
  const clock = () => options.evaluationDate ?? EVALUATION_DATE;

  return {
    policy,
    repository,
    decisionService: new DecisionService(policy, repository, clock),
    consentService: new ConsentService(policy, repository, clock),
  };
}

export const childChat = {
  subjectId: "child-1",
  dateOfBirth: "2015-03-01",
  jurisdiction: "DE",
  feature: "chat",
};

export const adultPurchase = {
  subjectId: "adult-1",
  dateOfBirth: "1990-06-15",
  jurisdiction: "US",
  feature: "purchases",
};

export const hardBlockedChildChat = {
  subjectId: "child-gb",
  dateOfBirth: "2015-03-01",
  jurisdiction: "GB",
  feature: "chat",
};
