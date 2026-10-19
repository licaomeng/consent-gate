import { evaluateDecision } from "@/domain/decision";
import { parseScenario } from "@/domain/scenario";
import type { DecisionResult, Policy } from "@/domain/types";
import type { ConsentRepository } from "@/repository/consent-repository";

export class DecisionService {
  constructor(
    private readonly policy: Policy,
    private readonly repository: ConsentRepository,
    private readonly clock: () => string,
  ) {}

  /**
   * Read-only. Checking access never creates or mutates consent state.
   */
  checkAccess(input: unknown): DecisionResult {
    const scenario = parseScenario(input, this.policy);
    const current = this.repository.getByScope(scenario);

    return evaluateDecision({
      scenario,
      policy: this.policy,
      evaluationDate: this.clock(),
      consentStatus: current?.status ?? null,
      consentRequestId: current?.id,
    });
  }
}
