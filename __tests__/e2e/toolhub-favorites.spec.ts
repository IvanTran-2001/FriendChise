import { test, expect } from "@playwright/test";
import { TEST_RUN_NAMESPACE } from "@/lib/test-run-namespace";

const ORG_NAME = `E2E [${TEST_RUN_NAMESPACE}] Toolhub Org ${Date.now()}`;

test("toggle and persist favorite tools in Toolhub", async ({ page }) => {
  let orgId: string | undefined;

  try {
    // 1. Create org
    await page.goto("/orgs/new");
    await page.getByLabel(/org name/i).fill(ORG_NAME);
    await page.getByRole("button", { name: /create organization/i }).click();
    await expect(page).toHaveURL(/\/orgs\/(?!new$|join$)[^/]+$/);

    const url = page.url();
    orgId = url.match(/\/orgs\/(?!new$|join$)([^/]+)$/)?.[1];
    expect(orgId).toBeTruthy();

    // 2. Go to Tools landing page
    await page.goto(`/orgs/${orgId}/tools`);

    // 3. Verify Favorites empty state is visible
    const emptyFavorites = page.locator('section:has-text("Favorites")');
    await expect(emptyFavorites.getByText(/no favorite tools yet/i)).toBeVisible();

    // 4. Locate Item List tool card in the main grid
    const toolsSection = page.locator('section:has-text("Tools")');
    const itemListCard = toolsSection.locator('a[href*="/tools/item-list"]');
    await expect(itemListCard).toBeVisible();

    // 5. Hover and click the star button to add it to favorites
    const starButton = itemListCard.getByRole("button", { name: /add to favorites/i });
    await itemListCard.hover();
    await starButton.click();

    // 6. Verify changes immediately in the UI
    // Card should now be visible in the Favorites section
    const favoriteSection = page.locator('section:has-text("Favorites")');
    await expect(favoriteSection.locator('a[href*="/tools/item-list"]')).toBeVisible();

    // Sidebar item should display a gold/amber star icon
    const sidebarItem = page.locator('.bg-sidebar a[href*="/tools/item-list"]');
    const sidebarStar = sidebarItem.locator('svg.text-amber-500');
    await expect(sidebarStar).toBeVisible();

    // 7. Reload page to verify persistence
    await page.reload();
    await expect(favoriteSection.locator('a[href*="/tools/item-list"]')).toBeVisible();
    await expect(sidebarStar).toBeVisible();

    // 8. Unfavorite from the Favorites section card
    const activeStarButton = favoriteSection.locator('a[href*="/tools/item-list"]').getByRole("button", { name: /remove from favorites/i });
    await activeStarButton.click();

    // 9. Verify it is removed immediately from Favorites and the sidebar star disappears
    await expect(favoriteSection.locator('a[href*="/tools/item-list"]')).not.toBeVisible();
    await expect(sidebarStar).not.toBeVisible();
    await expect(emptyFavorites.getByText(/no favorite tools yet/i)).toBeVisible();
  } finally {
    if (orgId) {
      // 10. Cleanup: Delete organization
      await page.goto(`/orgs/${orgId}/settings/organization`);
      await page.getByPlaceholder(ORG_NAME).fill(ORG_NAME);
      const deleteSection = page.getByTestId("delete-org-section");
      const deleteButton = deleteSection.getByRole("button", { name: /delete org/i });
      await expect(deleteButton).toBeEnabled();
      await deleteButton.click();
      await expect(page).toHaveURL("/");
    }
  }
});
