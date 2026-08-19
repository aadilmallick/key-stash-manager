import { test, expect } from "@playwright/test";

test.describe("secret CRUD", () => {
  test("add, reveal, edit, and delete a secret", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());

    await page.goto("/");
    await expect(page.getByRole("button", { name: "Add Secret" })).toBeVisible({
      timeout: 15000,
    });

    const secretName = `TEST_SECRET_${Date.now()}`;
    const secretValue = "super-secret-value-123";

    await page.getByRole("button", { name: "Add Secret" }).click();
    const addModal = page.getByRole("dialog");
    await addModal.locator("#name").fill(secretName);
    await addModal.locator("#value").fill(secretValue);
    await addModal.getByRole("button", { name: "Add Secret" }).click();

    const row = page.locator(".rounded-lg.p-4.shadow-sm", { hasText: secretName });
    await expect(row).toBeVisible();

    // masked by default
    await expect(row.locator("code")).not.toHaveText(secretValue);

    // reveal
    await row.locator("button:has(svg.lucide-eye)").click();
    await expect(row.locator("code")).toHaveText(secretValue);

    // edit
    await row.getByRole("button", { name: "Edit secret" }).click();
    const editModal = page.getByRole("dialog");
    const updatedValue = "updated-secret-value-456";
    await editModal.locator("#value").fill(updatedValue);
    await editModal.getByRole("button", { name: "Update Secret" }).click();

    // Reveal state persists per-secret across the edit (correct product
    // behavior - the row was already revealed above), so the value should
    // already be showing in plaintext without clicking reveal again.
    const updatedRow = page.locator(".rounded-lg.p-4.shadow-sm", { hasText: secretName });
    await expect(updatedRow.locator("code")).toHaveText(updatedValue);

    // delete
    await updatedRow.locator("button:has(svg.lucide-trash2)").click();
    await expect(
      page.locator(".rounded-lg.p-4.shadow-sm", { hasText: secretName }),
    ).toHaveCount(0);
  });
});
