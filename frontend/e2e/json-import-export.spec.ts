import { test, expect } from "@playwright/test";
import path from "path";
import os from "os";

test.describe("JSON export/import round trip", () => {
  test("exporting then re-importing preserves a secret", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Add Secret" })).toBeVisible({
      timeout: 15000,
    });

    const secretName = `ROUNDTRIP_${Date.now()}`;
    const secretValue = "roundtrip-secret-value";

    // Add a marker secret to round-trip.
    await page.getByRole("button", { name: "Add Secret" }).click();
    const addModal = page.getByRole("dialog");
    await addModal.locator("#name").fill(secretName);
    await addModal.locator("#value").fill(secretValue);
    await addModal.getByRole("button", { name: "Add Secret" }).click();
    await expect(
      page.locator(".rounded-lg.p-4.shadow-sm", { hasText: secretName }),
    ).toBeVisible();

    // Export all profiles.
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export All Profiles" }).click();
    const download = await downloadPromise;
    const exportPath = path.join(os.tmpdir(), `key-stash-export-${Date.now()}.json`);
    await download.saveAs(exportPath);

    // Delete the marker secret so re-import is the only way it comes back.
    const row = page.locator(".rounded-lg.p-4.shadow-sm", { hasText: secretName });
    await row.locator("button:has(svg.lucide-trash2)").click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(row).toHaveCount(0);

    // Re-import the exported file (full overwrite import).
    await page.getByRole("button", { name: "Import Secrets" }).click();
    const importDialog = page.locator("#import-modal");
    await expect(importDialog).toBeVisible();
    await importDialog.locator('input[type="file"]').setInputFiles(exportPath);
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Import" })
      .click();

    // The secret should be back after the overwrite-import completes.
    await expect(
      page.locator(".rounded-lg.p-4.shadow-sm", { hasText: secretName }),
    ).toBeVisible({ timeout: 15000 });
  });
});
