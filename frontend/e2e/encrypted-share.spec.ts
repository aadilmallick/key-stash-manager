import { test, expect } from "@playwright/test";
import path from "path";
import os from "os";

test.describe("Manual E2E encrypted share round trip", () => {
  test("export all profiles encrypted, then re-import via file + token", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Add Secret" })).toBeVisible({
      timeout: 15000,
    });

    const secretName = `SHARE_MARKER_${Date.now()}`;
    const secretValue = "shared-secret-value";

    // Add a marker secret to round-trip.
    await page.getByRole("button", { name: "Add Secret" }).click();
    const addModal = page.getByRole("dialog");
    await addModal.locator("#name").fill(secretName);
    await addModal.locator("#value").fill(secretValue);
    await addModal.getByRole("button", { name: "Add Secret" }).click();
    await expect(
      page.locator(".rounded-lg.p-4.shadow-sm", { hasText: secretName }),
    ).toBeVisible();

    // Open Profile Settings -> Share Securely -> encrypt "All profiles".
    await page.getByRole("button", { name: "Profile Settings" }).click();
    await page.getByRole("button", { name: "Share Securely" }).click();

    const shareDialog = page.getByRole("dialog", { name: "Share Securely" });
    await expect(shareDialog).toBeVisible();
    await shareDialog.getByRole("radio", { name: /All profiles/ }).click();

    const downloadPromise = page.waitForEvent("download");
    await shareDialog
      .getByRole("button", { name: "Encrypt & Download" })
      .click();
    const download = await downloadPromise;
    const exportPath = path.join(
      os.tmpdir(),
      `key-stash-share-${Date.now()}.enc`,
    );
    await download.saveAs(exportPath);

    const token = await shareDialog.locator("input[readonly]").inputValue();
    expect(token.length).toBeGreaterThan(0);

    // Close both dialogs, waiting for each close animation before the
    // next Escape - a second Escape sent while the first dialog is still
    // animating out can be swallowed.
    const settingsDialog = page.getByRole("dialog", { name: "Profile Settings" });
    await page.keyboard.press("Escape");
    await expect(shareDialog).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(settingsDialog).toBeHidden();

    // Delete the marker secret so re-import is the only way it comes back.
    const row = page.locator(".rounded-lg.p-4.shadow-sm", { hasText: secretName });
    await row.locator("button:has(svg.lucide-trash2)").click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(row).toHaveCount(0);

    // Re-import via the encrypted share section of the Import Secrets modal.
    await page.getByRole("button", { name: "Import Secrets" }).click();
    const importDialog = page.locator("#import-modal");
    await expect(importDialog).toBeVisible();

    await importDialog.locator("#encrypted-share-file").setInputFiles(exportPath);
    await importDialog.locator("#encrypted-share-token").fill(token);
    await importDialog
      .getByRole("button", { name: "Import Encrypted Share" })
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Import" })
      .click();

    // The secret should be back after the decrypt+import completes.
    await expect(
      page.locator(".rounded-lg.p-4.shadow-sm", { hasText: secretName }),
    ).toBeVisible({ timeout: 15000 });
  });

  test("rejects an incorrect decryption token with a clear error", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Add Secret" })).toBeVisible({
      timeout: 15000,
    });

    await page.getByRole("button", { name: "Profile Settings" }).click();
    await page.getByRole("button", { name: "Share Securely" }).click();

    const shareDialog = page.getByRole("dialog", { name: "Share Securely" });
    await shareDialog.getByRole("radio", { name: /All profiles/ }).click();

    const downloadPromise = page.waitForEvent("download");
    await shareDialog
      .getByRole("button", { name: "Encrypt & Download" })
      .click();
    const download = await downloadPromise;
    const exportPath = path.join(
      os.tmpdir(),
      `key-stash-share-bad-token-${Date.now()}.enc`,
    );
    await download.saveAs(exportPath);

    const settingsDialog = page.getByRole("dialog", { name: "Profile Settings" });
    await page.keyboard.press("Escape");
    await expect(shareDialog).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(settingsDialog).toBeHidden();

    await page.getByRole("button", { name: "Import Secrets" }).click();
    const importDialog = page.locator("#import-modal");
    await importDialog.locator("#encrypted-share-file").setInputFiles(exportPath);
    await importDialog
      .locator("#encrypted-share-token")
      .fill("aW52YWxpZC10b2tlbi12YWx1ZQ=="); // valid base64, wrong key
    await importDialog
      .getByRole("button", { name: "Import Encrypted Share" })
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Import" })
      .click();

    // exact: true - the toast title is "Import failed" verbatim, but Radix
    // Toast also renders a visually-hidden aria-live announcer whose text is
    // the concatenated title+description ("Import failedCouldn't decrypt
    // this share...") - a substring match hits both and is ambiguous.
    await expect(page.getByText("Import failed", { exact: true })).toBeVisible({
      timeout: 15000,
    });
  });
});
