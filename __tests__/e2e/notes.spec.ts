import { test, expect } from "@playwright/test";
import { prisma } from "../../lib/platform/prisma";
import { TEST_RUN_NAMESPACE } from "../../lib/demo/test-run-namespace";

test.describe("Notes Collaborative Flow", () => {
  test("two browser tabs sync content, trigger conflict banner, and handle delete redirects", async ({ browser }) => {
    // Resolve the exact namespaced organization name for the current test run
    const orgName = `Donut Shop A [${TEST_RUN_NAMESPACE}]`;
    const org = await prisma.organization.findFirst({
      where: { name: orgName },
    });
    if (!org) throw new Error(`Seed organization '${orgName}' not found in database.`);
    const ORG_ID = org.id;

    // 1. Create Context and Page for Tab A
    const contextA = await browser.newContext({ storageState: "playwright/.auth/ivan.json" });
    const pageA = await contextA.newPage();

    // 2. Create Context and Page for Tab B
    const contextB = await browser.newContext({ storageState: "playwright/.auth/ivan.json" });
    const pageB = await contextB.newPage();

    // Navigate both to the notes page
    await pageA.goto(`/orgs/${ORG_ID}/tools/notes`);
    await pageB.goto(`/orgs/${ORG_ID}/tools/notes`);

    // Let's create a new note page from Tab A
    await pageA.bringToFront();
    const createBtn = pageA.locator('button:has-text("New Page"), button:has-text("Create First Page")').first();
    await createBtn.click();

    // Wait for sidebar panel to appear
    await expect(pageA.locator('label:has-text("Page Title")')).toBeVisible();
    
    const uniqueTitle = `Collab Test ${Date.now()}`;
    await pageA.fill('input[placeholder="e.g. Shopping List"]', uniqueTitle);
    await pageA.click('button:has-text("Create Page")');

    // Confirm that the page title is displayed in the active note page for Tab A
    await expect(pageA.locator('#note-title-input')).toHaveValue(uniqueTitle);

    // --- Tab B needs to be brought to the front so document.visibilityState is "visible" ---
    // This allows Tab B's active polling (5s interval) to trigger and sync the list.
    await pageB.bringToFront();
    const sidebarLinkB = pageB.getByText(uniqueTitle).first();
    await expect(sidebarLinkB).toBeVisible({ timeout: 10000 });
    await sidebarLinkB.click();
    await expect(pageB.locator('#note-title-input')).toHaveValue(uniqueTitle);

    // --- Scenario 1: Syncing from Tab A to Tab B (not focused) ---
    // Tab B is not focused in the editor.
    // Bring Tab A to the front to type in the content.
    await pageA.bringToFront();
    const editorA = pageA.locator('.tiptap');
    await editorA.focus();
    await editorA.fill("");
    await editorA.pressSequentially("Milk, Eggs, Flour");

    // Wait for cloud save indicator to show "Saved to cloud"
    await expect(pageA.locator('span:has-text("Saved to cloud")')).toBeVisible({ timeout: 5000 });

    // Bring Tab B to front and wait for its editor to automatically sync and display content (5s interval)
    await pageB.bringToFront();
    const editorB = pageB.locator('.tiptap');
    await expect(editorB).toHaveText("Milk, Eggs, Flour", { timeout: 10000 });

    // --- Scenario 2: Triggering the Conflict Banner ---
    // Focus the editor in Tab B
    await editorB.focus();

    // Now, write to Tab A's editor to create a remote update
    await pageA.bringToFront();
    await editorA.focus();
    await editorA.fill("");
    await editorA.pressSequentially("Milk, Eggs, Flour, and Butter");
    await expect(pageA.locator('span:has-text("Saved to cloud")')).toBeVisible({ timeout: 5000 });

    // Bring Tab B to front and wait for the conflict banner to appear (since B is focused)
    await pageB.bringToFront();
    const conflictBanner = pageB.getByText("This page has been modified by another user.").first();
    await expect(conflictBanner).toBeVisible({ timeout: 10000 });

    // Click "Reload Changes" in Tab B and confirm that the content is updated
    const reloadBtn = pageB.locator('button:has-text("Reload Changes")');
    await reloadBtn.click();
    await expect(editorB).toHaveText("Milk, Eggs, Flour, and Butter");
    await expect(conflictBanner).not.toBeVisible();

    // --- Scenario 3: Page Deletion Redirect ---
    // Register dialog confirm handler for Tab A
    await pageA.bringToFront();
    pageA.once("dialog", async (dialog) => {
      await dialog.accept();
    });

    // Delete the page from Tab A
    const trashBtnA = pageA.locator('button[title="Delete page"]');
    await trashBtnA.click();

    // Verify Tab A gets redirected to empty state
    await expect(pageA.locator('h1:has-text("Collaborative Shared Notes")')).toBeVisible({ timeout: 5000 });

    // Bring Tab B to front and verify it gets redirected to empty state after the next poll (5-7 seconds)
    await pageB.bringToFront();
    await expect(pageB.locator('h1:has-text("Collaborative Shared Notes")')).toBeVisible({ timeout: 10000 });

    // Clean up contexts
    await contextA.close();
    await contextB.close();
  });
});
