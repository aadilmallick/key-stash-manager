import { test, expect } from "@playwright/test";

async function addSecret(page: import("@playwright/test").Page, name: string, value: string) {
  await page.getByRole("button", { name: "Add Secret" }).click();
  const modal = page.getByRole("dialog");
  await modal.locator("#name").fill(name);
  await modal.locator("#value").fill(value);
  await modal.getByRole("button", { name: "Add Secret" }).click();
  await expect(page.locator(".rounded-lg.p-4.shadow-sm", { hasText: name })).toBeVisible();
}

async function deleteSecret(page: import("@playwright/test").Page, name: string) {
  const row = page.locator(".rounded-lg.p-4.shadow-sm", { hasText: name });
  await row.locator("button:has(svg.lucide-trash2)").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(row).toHaveCount(0);
}

test.describe("checkbox multi-select + export", () => {
  test("select secrets via checkbox and export in all three formats", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Add Secret" })).toBeVisible({
      timeout: 15000,
    });

    const name1 = `EXPORT_TEST_A_${Date.now()}`;
    const name2 = `EXPORT_TEST_B_${Date.now()}`;
    const value1 = "value-one";
    const value2 = "value two"; // space forces shell-safe quoting

    await addSecret(page, name1, value1);
    await addSecret(page, name2, value2);

    const row1 = page.locator(".rounded-lg.p-4.shadow-sm", { hasText: name1 });
    const row2 = page.locator(".rounded-lg.p-4.shadow-sm", { hasText: name2 });
    await row1.getByRole("checkbox", { name: `Select ${name1}` }).click();
    await row2.getByRole("checkbox", { name: `Select ${name2}` }).click();

    await expect(page.getByRole("button", { name: "Export Selected (2)" })).toBeVisible();
    await page.getByRole("button", { name: "Export Selected (2)" }).click();

    const exportModal = page.getByRole("dialog");
    await expect(exportModal).toBeVisible();

    const textarea = exportModal.getByRole("textbox");
    await expect(textarea).toHaveValue(new RegExp(`${name1}=\\*+`));

    await exportModal.getByRole("button", { name: "Unmask" }).click();
    await expect(textarea).toHaveValue(new RegExp(`${name1}=${value1}\\n`));
    await expect(textarea).toHaveValue(new RegExp(`${name2}="${value2}"`));

    await exportModal.getByRole("tab", { name: "Export statements" }).click();
    await expect(exportModal.getByRole("textbox")).toHaveValue(
      new RegExp(`export ${name1}=${value1}`),
    );

    await page.keyboard.press("Escape");
    await expect(exportModal).toBeHidden();

    await deleteSecret(page, name1);
    await deleteSecret(page, name2);
  });
});

test.describe("global search", () => {
  // Retried because this test does no auth/billing work itself but can get
  // starved by Clerk's network load in other tests running concurrently
  // under Playwright's default multi-worker parallelism (documented in
  // DOCS/CODEBASE.md's Testing section) - a real regression here fails
  // every retry, this only rescues transient resource-contention timeouts.
  test.describe.configure({ retries: 2 });

  test("opens via button and Ctrl+K, filters by name, ignoring delimiters", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Add Secret" })).toBeVisible({
      timeout: 15000,
    });

    const uniqueName = `GLOBAL_SEARCH_TEST_${Date.now()}`;
    await addSecret(page, uniqueName, "some-value");

    await page.getByRole("button", { name: /Search/ }).click();
    const searchDialog = page.getByRole("dialog");
    await expect(searchDialog).toBeVisible();
    await expect(searchDialog.getByText("Search secrets")).toBeVisible();

    const searchInput = searchDialog.getByPlaceholder("Search secrets by name...");
    // Query uses lowercase + spaces where the real name uses underscores -
    // the delimiter/case-insensitive normalization should still match.
    await searchInput.fill(uniqueName.toLowerCase().replace(/_/g, " "));
    await expect(searchDialog.getByText(uniqueName, { exact: true })).toBeVisible({
      timeout: 2000,
    });

    await page.keyboard.press("Escape");
    await expect(searchDialog).toBeHidden();

    // Global keyboard shortcut also opens it.
    await page.keyboard.press("Control+k");
    const reopened = page.getByRole("dialog");
    await expect(reopened).toBeVisible();
    await expect(reopened.getByText("Search secrets")).toBeVisible();
    await page.keyboard.press("Escape");

    await deleteSecret(page, uniqueName);
  });
});
