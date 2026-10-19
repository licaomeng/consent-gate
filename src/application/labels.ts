import type { ConsentStatus, Decision, DecisionReason } from "@/domain/types";

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function humanizeCode(value: string): string {
  return value.replaceAll("_", " ");
}

export function featureLabel(feature: string): string {
  return titleCase(humanizeCode(feature));
}

export function decisionLabel(decision: Decision): string {
  switch (decision) {
    case "allowed":
      return "Allowed";
    case "blocked":
      return "Blocked";
    case "parental_consent":
      return "Needs parental consent";
  }
}

export function expectedTagLabel(decision: Decision): string {
  switch (decision) {
    case "allowed":
      return "Allowed";
    case "blocked":
      return "Blocked";
    case "parental_consent":
      return "Parental consent";
  }
}

export function reasonLabel(reason: DecisionReason): string {
  switch (reason) {
    case "meets_minimum_age":
      return "Meets the minimum age";
    case "under_minimum_age":
      return "Below the minimum age";
    case "parental_consent_required":
      return "Parental consent required";
    case "parental_consent_pending":
      return "Parental consent pending";
    case "parental_consent_approved":
      return "Parental consent approved";
    case "parental_consent_declined":
      return "Parental consent declined";
    case "no_matching_policy":
      return "No matching policy (fails closed)";
  }
}

export function consentStatusLabel(status: ConsentStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "declined":
      return "Declined";
  }
}
