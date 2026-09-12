import { test, expect } from "@playwright/test";

// Cheap render/regression smoke test only. API Spend is now gated behind
// Clerk auth + the Pro plan (PayWall.tsx) - this test runs signed out (no
// real Clerk session), so it asserts the paywall renders instead of the
// real SpendTab content, rather than exercising the proxy (which would
// additionally need real OpenAI/OpenRouter credentials and a reachable
// proxy - netlify dev or the Docker/Express server, neither of which plain
// `vite dev`, this suite's webServer, provides).
test.describe("API Spend tab", () => {
  test("shows the Pro paywall instead of the real tab when signed out", async ({ page }) => {
    test.skip(
      !!process.env.VITE_IS_TESTING,
      "the paywall is intentionally bypassed when VITE_IS_TESTING is set - see testing-mode-bypass.spec.ts",
    );
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Add Secret" })).toBeVisible({
      timeout: 15000,
    });

    await page.getByRole("tab", { name: "API Spend" }).click();
    // Generous timeout: useAuth().isLoaded only flips once Clerk's JS has
    // loaded from their CDN, unlike everything else in this suite.
    await expect(
      page.getByRole("heading", { name: "API Spend is a Pro feature" }),
    ).toBeVisible({ timeout: 20000 });
    await expect(
      page.getByText("You'll need a free account before you can subscribe."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Provider" })).toHaveCount(0);

    // Switching back to Secrets should still work fine.
    await page.getByRole("tab", { name: "Secrets" }).click();
    await expect(page.getByRole("button", { name: "Add Secret" })).toBeVisible();
  });
});
