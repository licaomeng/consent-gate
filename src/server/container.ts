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

const globalStore = globalThis as typeof globalThis & {
  __consentGateContainer?: Container;
};

// Create at module load so an invalid policy or clock fails startup. Storing it
// on globalThis also survives Next.js module reloads during development, which
// would otherwise reset the in-memory consent store mid-demo.
globalStore.__consentGateContainer ??= createContainer();

export function getContainer(): Container {
  return globalStore.__consentGateContainer as Container;
}

/**
 * Composition-root seam for tests and alternative storage. This is in-process
 * only; no request can reach it.
 */
export function setContainer(next: Container): void {
  globalStore.__consentGateContainer = next;
}

export function resetContainer(): void {
  globalStore.__consentGateContainer = createContainer();
}
