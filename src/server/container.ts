import policyJson from "@/data/policy.json";
import { loadPolicy } from "@/domain/policy";
import type { Policy } from "@/domain/types";
import {
  InMemoryConsentRepository,
  type ConsentRepository,
} from "@/repository/consent-repository";
import { ConsentService } from "@/services/consent-service";
import { DecisionService } from "@/services/decision-service";
import { getEvaluationDate } from "./clock";

export type Container = {
  policy: Policy;
  repository: ConsentRepository;
  decisionService: DecisionService;
  consentService: ConsentService;
};

export function createContainer(
  options: { repository?: ConsentRepository } = {},
): Container {
  // Fail fast at construction: an invalid policy or evaluation date must stop
  // startup, not become a 400 on the first request. The eager `initialContainer`
  // below runs this at module load (build/startup).
  const policy = loadPolicy(policyJson);
  getEvaluationDate();

  const repository = options.repository ?? new InMemoryConsentRepository();
  const clock = () => getEvaluationDate();

  return {
    policy,
    repository,
    decisionService: new DecisionService(policy, repository, clock),
    consentService: new ConsentService(policy, repository, clock),
  };
}

const initialContainer = createContainer();
let current: Container = initialContainer;

export function getContainer(): Container {
  return current;
}

/**
 * Composition-root seam for tests and alternative storage. This is in-process
 * only; no request can reach it.
 */
export function setContainer(next: Container): void {
  current = next;
}

export function resetContainer(): void {
  current = createContainer();
}
