import { describe, expect, it } from "vitest";
import {
  consentStatusLabel,
  decisionLabel,
  expectedTagLabel,
  featureLabel,
  reasonLabel,
} from "@/application/labels";

describe("labels", () => {
  it("humanizes feature identifiers", () => {
    expect(featureLabel("profile_photo")).toBe("Profile photo");
    expect(featureLabel("video_upload")).toBe("Video upload");
    expect(featureLabel("chat")).toBe("Chat");
  });

  it("labels decisions and expected tags", () => {
    expect(decisionLabel("allowed")).toBe("Allowed");
    expect(decisionLabel("blocked")).toBe("Blocked");
    expect(decisionLabel("parental_consent")).toBe("Needs parental consent");
    expect(expectedTagLabel("allowed")).toBe("Allowed");
    expect(expectedTagLabel("blocked")).toBe("Blocked");
    expect(expectedTagLabel("parental_consent")).toBe("Parental consent");
  });

  it("labels reasons without hiding the stable code", () => {
    expect(reasonLabel("meets_minimum_age")).toBe("Meets the minimum age");
    expect(reasonLabel("under_minimum_age")).toBe("Below the minimum age");
    expect(reasonLabel("parental_consent_required")).toBe(
      "Parental consent required",
    );
    expect(reasonLabel("parental_consent_pending")).toBe(
      "Parental consent pending",
    );
    expect(reasonLabel("parental_consent_approved")).toBe(
      "Parental consent approved",
    );
    expect(reasonLabel("parental_consent_declined")).toBe(
      "Parental consent declined",
    );
    expect(reasonLabel("no_matching_policy")).toContain("fails closed");
  });

  it("capitalizes consent statuses", () => {
    expect(consentStatusLabel("pending")).toBe("Pending");
    expect(consentStatusLabel("approved")).toBe("Approved");
    expect(consentStatusLabel("declined")).toBe("Declined");
  });
});
