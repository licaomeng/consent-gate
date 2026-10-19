import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("runs the full consent loop", async ({ page }) => {
  await page.getByTestId("demo-german-child-chat").click();
  await page.getByRole("button", { name: "Check access" }).click();

  await expect(page.getByTestId("decision")).toHaveText("Needs parental consent");
  await expect(page.getByTestId("reason")).toHaveText("parental_consent_required");
  await expect(page.getByTestId("evaluated-at")).toHaveText("2026-10-19");

  await page.getByRole("button", { name: "Ask a parent" }).click();
  await expect(page.getByTestId("request-status")).toHaveText("Pending");
  await expect(page.getByTestId("request-status")).toHaveClass(/status-pending/);
  await expect(page.getByTestId("request-status")).toHaveAttribute("aria-live", "polite");
  await expect(page.getByTestId("reason")).toHaveText("parental_consent_pending");
  await expect(page.getByTestId("waiting")).toHaveText("Waiting for parent");

  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByTestId("request-status")).toHaveText("Approved");
  await expect(page.getByTestId("request-status")).toHaveClass(/status-approved/);
  await expect(page.getByTestId("decision")).toHaveText("Allowed");
  await expect(page.getByTestId("decision-card")).toHaveClass(/decision-allowed/);
  await expect(page.getByTestId("reason")).toHaveText("parental_consent_approved");

  await page.getByRole("button", { name: "Decline" }).click();
  await expect(page.getByTestId("request-status")).toHaveText("Declined");
  await expect(page.getByTestId("request-status")).toHaveClass(/status-declined/);
  await expect(page.getByTestId("decision")).toHaveText("Blocked");
  await expect(page.getByTestId("decision-card")).toHaveClass(/decision-blocked/);
  await expect(page.getByTestId("reason")).toHaveText("parental_consent_declined");
});

test("a hard block never offers Ask a parent", async ({ page }) => {
  await page.getByTestId("demo-british-child-chat").click();
  await page.getByRole("button", { name: "Check access" }).click();

  await expect(page.getByTestId("decision")).toHaveText("Blocked");
  await expect(page.getByTestId("decision-card")).toHaveClass(/decision-blocked/);
  await expect(page.getByTestId("reason")).toHaveText("under_minimum_age");
  await expect(page.getByRole("button", { name: "Ask a parent" })).toHaveCount(0);
});

test("missing coverage is distinct from a hard block", async ({ page }) => {
  await page.getByTestId("demo-missing-coverage").click();
  await page.getByRole("button", { name: "Check access" }).click();

  await expect(page.getByTestId("decision")).toHaveText("Blocked");
  await expect(page.getByTestId("decision-card")).toHaveClass(/decision-blocked/);
  await expect(page.getByTestId("reason")).toHaveText("no_matching_policy");
  await expect(page.getByTestId("matched-rule")).toHaveText("No matching rule");
});

test("shows subdivision precedence evidence", async ({ page }) => {
  await page.getByTestId("demo-california-teen-chat").click();
  await page.getByRole("button", { name: "Check access" }).click();

  await expect(page.getByTestId("decision")).toHaveText("Needs parental consent");
  await expect(page.getByTestId("decision-card")).toHaveClass(/decision-parental_consent/);
  await expect(page.getByTestId("matched-rule")).toContainText("US-CA");
  await expect(page.getByTestId("lookup-path")).toContainText("US-CA");
});

test("shows each demo case's expected outcome before evaluation", async ({ page }) => {
  await expect(page.getByTestId("expected-us-adult-purchase")).toHaveText("Allowed");
  await expect(page.getByTestId("expected-german-child-chat")).toHaveText(
    "Parental consent",
  );
  await expect(page.getByTestId("expected-british-child-chat")).toHaveText("Blocked");
  await expect(page.getByTestId("demo-german-child-chat")).toContainText(
    "Full consent and reversal loop.",
  );
  await expect(page.getByTestId("decision")).toHaveCount(0);
});

test("marks the selected demo case and compares expected with actual", async ({ page }) => {
  const card = page.getByTestId("demo-german-child-chat");
  await card.click();
  await expect(card).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Check access" }).click();

  await expect(page.getByTestId("decision-card")).toHaveClass(/decision-parental_consent/);
  await expect(page.getByTestId("expected-actual")).toContainText(
    "Expected Needs parental consent",
  );
  await expect(page.getByTestId("expected-actual")).toContainText(
    "Actual Needs parental consent",
  );
  await expect(page.getByTestId("expected-actual")).toContainText(
    "Parental consent required",
  );
});

test("explains key controls with hover and focus help", async ({ page }) => {
  const help = page.getByTestId("help-new-subject");
  const tooltip = page.getByTestId("tooltip-new-subject");

  await expect(tooltip).toHaveCSS("opacity", "0");
  await help.hover();
  await expect(tooltip).toHaveCSS("opacity", "1");
  await help.focus();
  await expect(tooltip).toHaveCSS("opacity", "1");
  await expect(help).toHaveAttribute("aria-describedby", "new-subject-tooltip");
});

test("creates a new synthetic subject on demand", async ({ page }) => {
  const subject = page.locator(".subject code");
  const before = await subject.textContent();

  await page.getByTestId("new-subject").click();

  await expect(subject).not.toHaveText(before ?? "");
});

test("lists other consent scopes for the same subject", async ({ page }) => {
  await page.getByTestId("demo-german-child-chat").click();
  await page.getByRole("button", { name: "Check access" }).click();
  await page.getByRole("button", { name: "Ask a parent" }).click();
  await expect(page.getByTestId("request-status")).toHaveText("Pending");

  // Keep the subject, change the scope: this must not hide the first request.
  await page.getByLabel("Jurisdiction").fill("US");
  await page.getByLabel("Feature", { exact: true }).selectOption("purchases");
  await page.getByRole("button", { name: "Check access" }).click();
  await page.getByRole("button", { name: "Ask a parent" }).click();
  await expect(page.getByTestId("request-status")).toHaveText("Pending");

  await expect(page.getByTestId("other-requests")).toContainText("Chat");
  await expect(page.getByTestId("other-requests")).toContainText("Pending");
});

test("exposes live regions and labelled controls", async ({ page }) => {
  await expect(page.getByTestId("decision-summary")).toHaveAttribute("role", "status");
  await expect(page.getByTestId("decision-summary")).toHaveAttribute(
    "aria-live",
    "polite",
  );
  await expect(page.getByTestId("progress")).toHaveAttribute("role", "status");
  await expect(page.getByLabel("Date of birth")).toBeVisible();
  await expect(page.getByLabel("Jurisdiction")).toBeVisible();
  await expect(page.getByLabel("Feature", { exact: true })).toBeVisible();
});

test("matches a pending request even when the typed jurisdiction is lowercase", async ({ page }) => {
  await page.getByTestId("demo-german-child-chat").click();
  await page.getByRole("button", { name: "Check access" }).click();
  await page.getByRole("button", { name: "Ask a parent" }).click();
  await expect(page.getByTestId("request-status")).toHaveText("Pending");

  await page.getByLabel("Jurisdiction").fill("de");
  await page.getByRole("button", { name: "Check access" }).click();

  await expect(page.getByTestId("reason")).toHaveText("parental_consent_pending");
  await expect(page.getByTestId("request-status")).toHaveText("Pending");
  await expect(page.getByRole("button", { name: "Ask a parent" })).toHaveCount(0);
});

test("does not treat an unreadable consent state as no request", async ({ page }) => {
  await page.route(/\/api\/v1\/consent-requests\?subjectId=/, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "dependency_unavailable", message: "down" },
      }),
    }),
  );

  await page.getByTestId("demo-german-child-chat").click();
  await page.getByRole("button", { name: "Check access" }).click();

  await expect(page.getByTestId("error")).toContainText("Consent state could not be read");
  await expect(page.getByRole("button", { name: "Ask a parent" })).toHaveCount(0);
});

test("clears the old decision when the post-action refresh fails", async ({ page }) => {
  let decisionCalls = 0;
  await page.route("**/api/v1/decisions", async (route) => {
    decisionCalls += 1;
    if (decisionCalls === 2) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "internal_error", message: "boom" },
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.getByTestId("demo-german-child-chat").click();
  await page.getByRole("button", { name: "Check access" }).click();
  await page.getByRole("button", { name: "Ask a parent" }).click();
  await page.getByRole("button", { name: "Approve" }).click();

  await expect(page.getByTestId("request-status")).toHaveText("Approved");
  await expect(page.getByTestId("decision")).toHaveCount(0);
  await expect(page.getByTestId("error")).toBeVisible();
});

test("locks the scenario inputs while a parent action is in flight", async ({ page }) => {
  await page.route("**/api/v1/consent-requests/*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });

  await page.getByTestId("demo-german-child-chat").click();
  await page.getByRole("button", { name: "Check access" }).click();
  await page.getByRole("button", { name: "Ask a parent" }).click();
  await page.getByRole("button", { name: "Approve" }).click();

  await expect(page.getByLabel("Jurisdiction")).toBeDisabled();
});

test("announces progress while a check is in flight", async ({ page }) => {
  await page.route("**/api/v1/decisions", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });

  await page.getByTestId("demo-german-child-chat").click();
  await page.getByRole("button", { name: "Check access" }).click();

  await expect(page.getByTestId("progress")).toHaveText("Checking access…");
});

test.describe("API error contract", () => {
  test("returns 409 for a hard-block consent request", async ({ request }) => {
    const response = await request.post("/api/v1/consent-requests", {
      data: {
        subjectId: "http-gb",
        dateOfBirth: "2015-03-01",
        jurisdiction: "GB",
        feature: "chat",
      },
    });

    expect(response.status()).toBe(409);
    expect((await response.json()).error.code).toBe("consent_not_required");
  });

  test("returns 400 for a client-supplied evaluation date", async ({ request }) => {
    const response = await request.post("/api/v1/decisions", {
      data: {
        subjectId: "http-child",
        dateOfBirth: "2015-03-01",
        jurisdiction: "DE",
        feature: "chat",
        evaluationDate: "2040-01-01",
      },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.code).toBe("validation_error");
  });

  test("returns 404 for an unknown consent request id", async ({ request }) => {
    const response = await request.patch("/api/v1/consent-requests/missing", {
      data: { status: "approved" },
    });

    expect(response.status()).toBe(404);
    expect((await response.json()).error.code).toBe("request_not_found");
  });
});

test("clears the previous decision when the input changes", async ({ page }) => {
  await page.getByTestId("demo-german-child-chat").click();
  await page.getByRole("button", { name: "Check access" }).click();
  await expect(page.getByTestId("decision")).toHaveText("Needs parental consent");

  await page.getByLabel("Jurisdiction").fill("GB");

  await expect(page.getByTestId("decision")).toHaveCount(0);
});
