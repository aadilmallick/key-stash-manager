import { test, expect } from "@playwright/test";

// Cheap render/regression smoke test only - a full keyed round trip needs
// real OpenAI/OpenRouter credentials and a reachable proxy (netlify dev or
// the Docker/Express server), neither of which plain `vite dev` (this
// suite's webServer) provides. This test never triggers the proxy.
test.describe("API Spend tab", () => {
  test("renders and offers Add Provider without crashing", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Add Secret" })).toBeVisible({
      timeout: 15000,
    });

    await page.getByRole("tab", { name: "API Spend" }).click();
    await expect(page.getByRole("heading", { name: "API Spend" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Provider" })).toBeVisible();
    await expect(page.getByText("No providers connected yet")).toBeVisible();

    // Switching back to Secrets should still work fine.
    await page.getByRole("tab", { name: "Secrets" }).click();
    await expect(page.getByRole("button", { name: "Add Secret" })).toBeVisible();
  });
});
