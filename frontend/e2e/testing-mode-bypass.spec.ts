import { test, expect } from "@playwright/test";

// Only meaningful when the dev server was actually started with
// VITE_IS_TESTING=true - e.g.
//   VITE_IS_TESTING=true npm run test:e2e --prefix frontend
// Playwright's webServer.env supplements (doesn't replace) process.env, so
// this flag flows straight through to the Vite dev server it spawns. Run
// without the flag, everything here is skipped and the rest of the suite
// (including api-spend-tab.spec.ts's real-paywall assertion) is unaffected.
test.describe("VITE_IS_TESTING bypass", () => {
  test.skip(
    !process.env.VITE_IS_TESTING,
    "run with VITE_IS_TESTING=true to exercise the auth/billing bypass",
  );

  test("API Spend tab is fully usable with no sign-in or subscription", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Add Secret" })).toBeVisible({
      timeout: 15000,
    });

    // No Clerk header controls - AuthControls renders nothing in test mode.
    await expect(page.getByRole("button", { name: "Sign in" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sign up" })).toHaveCount(0);

    await page.getByRole("tab", { name: "API Spend" }).click();

    // The real SpendTab renders immediately - no paywall, no Clerk load wait.
    await expect(page.getByRole("button", { name: "Add Provider" })).toBeVisible();
    await expect(page.getByText("No providers connected yet")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "API Spend is a Pro feature" }),
    ).toHaveCount(0);
  });
});
