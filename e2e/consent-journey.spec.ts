import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("runs the full consent loop", async ({ page }) => {
  await page.getByRole("button", { name: "German child chat" }).click();
  await page.getByRole("button", { name: "Check access" }).click();

  await expect(page.getByTestId("decision")).toHaveText("Needs parental consent");
  await expect(page.getByTestId("reason")).toHaveText("parental_consent_required");

  await page.getByRole("button", { name: "Ask a parent" }).click();
  await expect(page.getByTestId("request-status")).toHaveText("pending");
  await expect(page.getByTestId("reason")).toHaveText("parental_consent_pending");
  await expect(page.getByTestId("waiting")).toHaveText("Waiting for parent");

  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByTestId("request-status")).toHaveText("approved");
  await expect(page.getByTestId("decision")).toHaveText("Allowed");
  await expect(page.getByTestId("reason")).toHaveText("parental_consent_approved");

  await page.getByRole("button", { name: "Decline" }).click();
  await expect(page.getByTestId("request-status")).toHaveText("declined");
  await expect(page.getByTestId("decision")).toHaveText("Blocked");
  await expect(page.getByTestId("reason")).toHaveText("parental_consent_declined");
});

test("a hard block never offers Ask a parent", async ({ page }) => {
  await page.getByRole("button", { name: "British child chat" }).click();
  await page.getByRole("button", { name: "Check access" }).click();

  await expect(page.getByTestId("decision")).toHaveText("Blocked");
  await expect(page.getByTestId("reason")).toHaveText("under_minimum_age");
  await expect(page.getByRole("button", { name: "Ask a parent" })).toHaveCount(0);
});

test("missing coverage is distinct from a hard block", async ({ page }) => {
  await page.getByRole("button", { name: "Missing coverage" }).click();
  await page.getByRole("button", { name: "Check access" }).click();

  await expect(page.getByTestId("decision")).toHaveText("Blocked");
  await expect(page.getByTestId("reason")).toHaveText("no_matching_policy");
  await expect(page.getByTestId("matched-rule")).toHaveText("No matching rule");
});

test("shows subdivision precedence evidence", async ({ page }) => {
  await page.getByRole("button", { name: "California teen chat" }).click();
  await page.getByRole("button", { name: "Check access" }).click();

  await expect(page.getByTestId("decision")).toHaveText("Needs parental consent");
  await expect(page.getByTestId("matched-rule")).toContainText("US-CA");
  await expect(page.getByTestId("lookup-path")).toContainText("US-CA");
});

test("shows the preset's expected outcome and purpose before evaluation", async ({ page }) => {
  await page.getByRole("button", { name: "German child chat" }).click();

  await expect(page.getByTestId("preset-hint")).toContainText("Needs parental consent");
  await expect(page.getByTestId("preset-hint")).toContainText("Full consent and reversal loop.");
  await expect(page.getByTestId("decision")).toHaveCount(0);
});

test("matches a pending request even when the typed jurisdiction is lowercase", async ({ page }) => {
  await page.getByRole("button", { name: "German child chat" }).click();
  await page.getByRole("button", { name: "Check access" }).click();
  await page.getByRole("button", { name: "Ask a parent" }).click();
  await expect(page.getByTestId("request-status")).toHaveText("pending");

  await page.getByLabel("Jurisdiction").fill("de");
  await page.getByRole("button", { name: "Check access" }).click();

  await expect(page.getByTestId("reason")).toHaveText("parental_consent_pending");
  await expect(page.getByTestId("request-status")).toHaveText("pending");
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

  await page.getByRole("button", { name: "German child chat" }).click();
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

  await page.getByRole("button", { name: "German child chat" }).click();
  await page.getByRole("button", { name: "Check access" }).click();
  await page.getByRole("button", { name: "Ask a parent" }).click();
  await page.getByRole("button", { name: "Approve" }).click();

  await expect(page.getByTestId("request-status")).toHaveText("approved");
  await expect(page.getByTestId("decision")).toHaveCount(0);
  await expect(page.getByTestId("error")).toBeVisible();
});

test("announces progress while a check is in flight", async ({ page }) => {
  await page.route("**/api/v1/decisions", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });

  await page.getByRole("button", { name: "German child chat" }).click();
  await page.getByRole("button", { name: "Check access" }).click();

  await expect(page.getByTestId("progress")).toHaveText("Checking access…");
});

test("ignores a stale decision response after the input changes", async ({ page }) => {
  let decisionCalls = 0;
  await page.route("**/api/v1/decisions", async (route) => {
    decisionCalls += 1;
    if (decisionCalls === 1) {
      await new Promise((resolve) => setTimeout(resolve, 1_200));
    }
    await route.continue();
  });

  await page.getByRole("button", { name: "German child chat" }).click();
  const pendingClick = page.getByRole("button", { name: "Check access" }).click();
  await page.waitForTimeout(200);

  // Invalidate the in-flight response by changing the scenario.
  await page.getByLabel("Jurisdiction").fill("GB");
  await pendingClick;

  await page.waitForTimeout(1_500);
  await expect(page.getByTestId("decision")).toHaveCount(0);
});
