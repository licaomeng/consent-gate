export type Decision = "allowed" | "blocked" | "parental_consent";

export type ConsentStatus = "pending" | "approved" | "declined";

export type ConsentAction = "request" | "approve" | "decline";

export type ConsentTransition = {
  status: ConsentStatus;
  changed: boolean;
};

export type UnderAgeAction = "blocked" | "parental_consent";

export type DecisionReason =
  | "meets_minimum_age"
  | "under_minimum_age"
  | "parental_consent_required"
  | "parental_consent_pending"
  | "parental_consent_approved"
  | "parental_consent_declined"
  | "no_matching_policy";

export type PolicyRule = {
  jurisdiction: string;
  feature: string;
  minAge: number;
  ifUnder: UnderAgeAction;
};

export type Policy = {
  features: readonly string[];
  rules: readonly PolicyRule[];
};

export type Scenario = {
  subjectId: string;
  dateOfBirth: string;
  jurisdiction: string;
  feature: string;
};

export type DecisionResult = {
  decision: Decision;
  reason: DecisionReason;
  age: number;
  evaluatedAt: string;
  lookupPath: string[];
  matchedRule: PolicyRule | null;
  consentRequestId?: string;
};

export type ConsentRequest = {
  id: string;
  subjectId: string;
  jurisdiction: string;
  feature: string;
  status: ConsentStatus;
  createdAt: string;
  updatedAt: string;
};
