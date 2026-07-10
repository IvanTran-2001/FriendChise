import { test, expect } from "@playwright/test";
import { TEST_RUN_NAMESPACE } from "@/lib/test-run-namespace";

const ORG_NAME = `E2E [${TEST_RUN_NAMESPACE}] Conversion Favs Org ${Date.now()}`;
const SET_NAME = `E2E Test Set ${Date.now()}`;

test("toggle and persist favorite conversion sets", async ({ page }) => {
  test.setTimeout(60000);
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

    // 2. Navigate to Conversion tool hub
    await page.goto(`/orgs/${orgId}/tools/conversion`);

    // 3. Create a new Conversion Set
    await page.getByRole("button", { name: /add set/i }).click();
    await page.locator("#set-name").fill(SET_NAME);
    await page.getByRole("button", { name: /save/i }).click();

    // 4. Verify Favorites empty state is visible (since sets.length > 0 now)
    const emptyFavorites = page.locator('section:has-text("Favorites")');
    await expect(emptyFavorites.getByText(/no favorite conversion sets yet/i)).toBeVisible();

    // 5. Locate the newly created set card in the main grid
    const setsSection = page.locator('section:has-text("Conversion Sets")');
    const setCard = setsSection.locator(`a:has-text("${SET_NAME}")`);
    await expect(setCard).toBeVisible();

    // 6. Hover and click the star button to add it to favorites
    const starButton = setCard.getByRole("button", { name: /add to favorites/i });
    await setCard.hover();
    await starButton.click();

    // 7. Verify changes immediately in the UI (card in Favorites section)
    const favoriteSection = page.locator('section:has-text("Favorites")');
    await expect(favoriteSection.locator(`a:has-text("${SET_NAME}")`)).toBeVisible();

    // 8. Click card to navigate to its detail page
    await setCard.locator(`span:has-text("${SET_NAME}")`).click();
    await expect(page).toHaveURL(/\/orgs\/[^/]+\/tools\/conversion\/[^/]+$/);

    // 9. Verify the star button next to the title is active (shows "Remove from favorites")
    const headerStar = page.getByRole("button", { name: /remove from favorites/i });
    await expect(headerStar).toBeVisible();

    // 10. Click the header star to unfavorite
    await headerStar.click();

    // 11. Go back to Conversion landing page
    await page.goto(`/orgs/${orgId}/tools/conversion`);

    // 12. Verify it is removed immediately from Favorites
    await expect(favoriteSection.locator(`a:has-text("${SET_NAME}")`)).not.toBeVisible();
    await expect(emptyFavorites.getByText(/no favorite conversion sets yet/i)).toBeVisible();

    // 13. Favorite it again from the Conversion Sets card
    await setCard.hover();
    const addStarButton = setCard.getByRole("button", { name: /add to favorites/i });
    await addStarButton.click();
    await expect(favoriteSection.locator(`a:has-text("${SET_NAME}")`)).toBeVisible();

    // 14. Reload page to verify persistence
    await page.reload();
    await expect(favoriteSection.locator(`a:has-text("${SET_NAME}")`)).toBeVisible();

    // 15. Unfavorite from the Favorites section card
    const removeStarButton = favoriteSection.locator(`a:has-text("${SET_NAME}")`).getByRole("button", { name: /remove from favorites/i });
    await removeStarButton.click();
    await expect(favoriteSection.locator(`a:has-text("${SET_NAME}")`)).not.toBeVisible();
  } finally {
    if (orgId) {
      // 16. Cleanup: Delete organization
      await page.goto(`/orgs/${orgId}/settings/organization`);
      await page.getByPlaceholder(ORG_NAME).fill(ORG_NAME);
      const deleteSection = page.getByTestId("delete-org-section");
      const deleteButton = deleteSection.getByRole("button", { name: /delete org/i });
      await expect(deleteButton).toBeEnabled();
      await deleteButton.click();
      await expect(page).toHaveURL(/\/(\?orgNotFound=1)?$/);
    }
  }
});
