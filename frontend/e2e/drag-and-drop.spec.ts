import { test, expect, type Page } from "@playwright/test";

// HTML5-native drag-and-drop (react-dnd's HTML5Backend) is a known-flaky
// thing to automate - Playwright's dragTo() drives it through real input
// events rather than synthetic DOM events, which generally works in
// Chromium, but timing/positioning is more sensitive than a plain click.
// If these prove unreliable in CI, manual chrome-devtools MCP verification
// is the real confidence check for this feature (see the plan).

async function addFolderViaUI(page: Page, name: string) {
  await page.getByRole("button", { name: "Add folder" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("Folder name").fill(name);
  await dialog.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

async function addSecretViaUI(page: Page, name: string, value: string) {
  await page.getByRole("button", { name: "Add Secret" }).click();
  const modal = page.getByRole("dialog");
  await modal.locator("#name").fill(name);
  await modal.locator("#value").fill(value);
  await modal.getByRole("button", { name: "Add Secret" }).click();
  await expect(
    page.locator(".rounded-lg.p-4.shadow-sm", { hasText: name }),
  ).toBeVisible();
}

function folderRow(page: Page, name: string) {
  return page.locator('[role="list"] > div').filter({ hasText: name });
}

async function folderNamesInOrder(page: Page): Promise<string[]> {
  return page.locator('[role="list"] span.text-sm').allTextContents();
}

test.describe("drag-and-drop", () => {
  test("dragging a folder reorders it, persisted across reload", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Add Secret" })).toBeVisible({
      timeout: 15000,
    });

    const folderA = `DND_FOLDER_A_${Date.now()}`;
    const folderB = `DND_FOLDER_B_${Date.now()}`;
    await addFolderViaUI(page, folderA);
    await addFolderViaUI(page, folderB);

    const before = await folderNamesInOrder(page);
    expect(before.indexOf(folderA)).toBeLessThan(before.indexOf(folderB));

    const handleA = page.getByLabel(`Drag to reorder ${folderA}`);
    // Drop just inside the bottom edge of folderB's row to land *after* it
    // (dropBefore is computed from cursor Y vs. the row's own midpoint).
    const targetBox = await folderRow(page, folderB).boundingBox();
    if (!targetBox) throw new Error("folderB row not found");
    await handleA.dragTo(folderRow(page, folderB), {
      targetPosition: { x: 10, y: targetBox.height - 2 },
    });

    const after = await folderNamesInOrder(page);
    expect(after.indexOf(folderA)).toBeGreaterThan(after.indexOf(folderB));

    await page.reload();
    await expect(page.getByRole("button", { name: "Add Secret" })).toBeVisible({
      timeout: 15000,
    });
    // "Add Secret" visible only means the vault is ready, not that the
    // folders collection's live query has delivered its persisted rows yet
    // (only `config` is explicitly preloaded before the app is marked
    // ready) - wait for folderB to actually reappear before reading order,
    // rather than asserting against a still-hydrating list.
    await expect(page.getByText(folderB, { exact: true })).toBeVisible({
      timeout: 10000,
    });
    const afterReload = await folderNamesInOrder(page);
    expect(afterReload.indexOf(folderA)).toBeGreaterThan(
      afterReload.indexOf(folderB),
    );
  });

  test("dragging a secret onto a different folder moves it there", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Add Secret" })).toBeVisible({
      timeout: 15000,
    });

    const targetFolderName = `DND_TARGET_${Date.now()}`;
    await addFolderViaUI(page, targetFolderName);

    const secretName = `DND_SECRET_${Date.now()}`;
    await addSecretViaUI(page, secretName, "dnd-value");

    const secretHandle = page.getByLabel(`Drag to reorder ${secretName}`);
    await secretHandle.dragTo(folderRow(page, targetFolderName));

    // Gone from the folder it was dragged out of...
    await expect(
      page.locator(".rounded-lg.p-4.shadow-sm", { hasText: secretName }),
    ).toHaveCount(0);

    // ...and present in the destination folder.
    await folderRow(page, targetFolderName).click();
    await expect(
      page.locator(".rounded-lg.p-4.shadow-sm", { hasText: secretName }),
    ).toBeVisible();
  });

  test("a name collision on drop shows a confirm dialog; cancel leaves both untouched, confirm overwrites", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Add Secret" })).toBeVisible({
      timeout: 15000,
    });

    const sourceFolderName = `DND_SRC_${Date.now()}`;
    const targetFolderName = `DND_DST_${Date.now()}`;
    await addFolderViaUI(page, sourceFolderName);
    await addFolderViaUI(page, targetFolderName);

    const sourceRow = folderRow(page, sourceFolderName);
    const targetRow = folderRow(page, targetFolderName);
    const secretName = `DND_COLLIDE_${Date.now()}`;

    await sourceRow.click();
    await addSecretViaUI(page, secretName, "value-in-source");

    await targetRow.click();
    await addSecretViaUI(page, secretName, "value-in-target");

    await sourceRow.click();
    await expect(
      page.locator(".rounded-lg.p-4.shadow-sm", { hasText: secretName }),
    ).toBeVisible();

    const secretHandle = page.getByLabel(`Drag to reorder ${secretName}`);

    // Cancel: nothing changes.
    await secretHandle.dragTo(targetRow);
    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible();
    await expect(
      confirmDialog.getByRole("heading", { name: "Secret already exists" }),
    ).toBeVisible();
    await confirmDialog.getByRole("button", { name: "Cancel" }).click();

    await expect(
      page.locator(".rounded-lg.p-4.shadow-sm", { hasText: secretName }),
    ).toBeVisible();
    await targetRow.click();
    await expect(
      page.locator(".rounded-lg.p-4.shadow-sm", { hasText: secretName }),
    ).toHaveCount(1);

    // Overwrite: source's copy replaces target's.
    await sourceRow.click();
    await secretHandle.dragTo(targetRow);
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Overwrite" })
      .click();

    await expect(
      page.locator(".rounded-lg.p-4.shadow-sm", { hasText: secretName }),
    ).toHaveCount(0);
    await targetRow.click();
    await expect(
      page.locator(".rounded-lg.p-4.shadow-sm", { hasText: secretName }),
    ).toHaveCount(1);
  });
});
