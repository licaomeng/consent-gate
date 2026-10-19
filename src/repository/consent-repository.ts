import type { ConsentRequest, ConsentStatus } from "@/domain/types";

export type ConsentScope = {
  subjectId: string;
  jurisdiction: string;
  feature: string;
};

/** Infrastructure failure. HTTP callers map this to `dependency_unavailable`. */
export class RepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepositoryError";
  }
}

export type CreateConsentResult = {
  request: ConsentRequest;
  created: boolean;
};

export interface ConsentRepository {
  getByScope(scope: ConsentScope): ConsentRequest | null;
  getById(id: string): ConsentRequest | null;
  listBySubject(subjectId: string): ConsentRequest[];
  /**
   * The write reports whether it inserted. A production repository may enforce
   * uniqueness inside `create`, so the service must not infer `created` from
   * the earlier lookup alone.
   */
  create(scope: ConsentScope): CreateConsentResult;
  /**
   * The service checks `getById` first and owns the 404 for an unknown id. A
   * missing row at write time is a storage inconsistency (503), not a second
   * lookup path; cross-process races are outside the exercise's guarantees.
   */
  updateStatus(id: string, status: ConsentStatus): ConsentRequest;
}

function scopeKey(scope: ConsentScope): string {
  return `${scope.subjectId}\u0000${scope.jurisdiction}\u0000${scope.feature}`;
}

/**
 * Exercise storage. One logical record per scope; state resets with the
 * process. Records are copied in and out so callers cannot mutate stored state.
 */
export class InMemoryConsentRepository implements ConsentRepository {
  private readonly byId = new Map<string, ConsentRequest>();
  private readonly idByScope = new Map<string, string>();

  getByScope(scope: ConsentScope): ConsentRequest | null {
    const id = this.idByScope.get(scopeKey(scope));
    if (!id) return null;
    const record = this.byId.get(id);
    return record ? { ...record } : null;
  }

  getById(id: string): ConsentRequest | null {
    const record = this.byId.get(id);
    return record ? { ...record } : null;
  }

  listBySubject(subjectId: string): ConsentRequest[] {
    return [...this.byId.values()]
      .filter((record) => record.subjectId === subjectId)
      .map((record) => ({ ...record }));
  }

  create(scope: ConsentScope): CreateConsentResult {
    const key = scopeKey(scope);
    const existingId = this.idByScope.get(key);
    if (existingId) {
      const existing = this.byId.get(existingId);
      if (existing) return { request: { ...existing }, created: false };
    }

    const now = new Date().toISOString();
    const record: ConsentRequest = {
      id: crypto.randomUUID(),
      subjectId: scope.subjectId,
      jurisdiction: scope.jurisdiction,
      feature: scope.feature,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    this.byId.set(record.id, record);
    this.idByScope.set(key, record.id);
    return { request: { ...record }, created: true };
  }

  updateStatus(id: string, status: ConsentStatus): ConsentRequest {
    const current = this.byId.get(id);
    if (!current) {
      throw new RepositoryError(`consent request not found: ${id}`);
    }

    const updated: ConsentRequest = {
      ...current,
      status,
      updatedAt: new Date().toISOString(),
    };
    this.byId.set(id, updated);
    return { ...updated };
  }
}
