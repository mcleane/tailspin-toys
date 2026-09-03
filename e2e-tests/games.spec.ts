import { test, expect, type Page, type Response } from '@playwright/test';

async function visibleGameCardCount(page: Page): Promise<number> {
  return page.getByTestId('game-card').evaluateAll((cards) =>
    cards.filter((card) => !card.classList.contains('hidden')).length,
  );
}

test.describe('Game Listing and Navigation', () => {
  test('should display games with titles on index page', async ({ page }) => {
    await test.step('Navigate to homepage', async () => {
      await page.goto('/');
    });

    await test.step('Verify games grid is visible', async () => {
      const gamesGrid = page.getByTestId('games-grid');
      await expect(gamesGrid).toBeVisible();
    });

    await test.step('Verify game cards are displayed', async () => {
      const gameCards = page.getByTestId('game-card');
      await expect(gameCards.first()).toBeVisible();
      expect(await gameCards.count()).toBeGreaterThan(0);
    });

    await test.step('Verify game cards have titles with content', async () => {
      const gameCards = page.getByTestId('game-card');
      await expect(gameCards.first().getByTestId('game-title')).toBeVisible();
      await expect(gameCards.first().getByTestId('game-title')).not.toBeEmpty();
    });
  });

  test('should navigate to correct game details page when clicking on a game', async ({ page }) => {
    let gameId: string | null;
    let gameTitle: string | null;

    await test.step('Navigate to homepage and wait for games to load', async () => {
      await page.goto('/');
      const gamesGrid = page.getByTestId('games-grid');
      await expect(gamesGrid).toBeVisible();
    });

    await test.step('Get first game information and click it', async () => {
      const firstGameCard = page.getByTestId('game-card').first();
      gameId = await firstGameCard.getAttribute('data-game-id');
      gameTitle = await firstGameCard.getAttribute('data-game-title');
      await firstGameCard.click();
    });

    await test.step('Verify navigation to game details page', async () => {
      await expect(page).toHaveURL(`/game/${gameId}`);
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Verify game title matches clicked game', async () => {
      if (gameTitle) {
        await expect(page.getByTestId('game-details-title')).toHaveText(gameTitle);
      }
    });
  });

  test('should display game details with all required information', async ({ page }) => {
    await test.step('Navigate to specific game details page', async () => {
      await page.goto('/game/1');
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Verify game title is displayed', async () => {
      const gameTitle = page.getByTestId('game-details-title');
      await expect(gameTitle).toBeVisible();
      await expect(gameTitle).not.toBeEmpty();
    });

    await test.step('Verify game description is displayed', async () => {
      const gameDescription = page.getByTestId('game-details-description');
      await expect(gameDescription).toBeVisible();
      await expect(gameDescription).not.toBeEmpty();
    });

    await test.step('Verify publisher or category information is present', async () => {
      const publisherExists = await page.getByTestId('game-details-publisher').isVisible();
      const categoryExists = await page.getByTestId('game-details-category').isVisible();
      expect(publisherExists || categoryExists).toBeTruthy();

      if (publisherExists) {
        await expect(page.getByTestId('game-details-publisher')).not.toBeEmpty();
      }

      if (categoryExists) {
        await expect(page.getByTestId('game-details-category')).not.toBeEmpty();
      }
    });
  });

  test('should display a button to back the game', async ({ page }) => {
    await test.step('Navigate to game details page', async () => {
      await page.goto('/game/1');
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Verify back game button is visible and enabled', async () => {
      const backButton = page.getByTestId('back-game-button');
      await expect(backButton).toBeVisible();
      await expect(backButton).toContainText('Support This Game');
      await expect(backButton).toBeEnabled();
    });
  });

  test('should be able to navigate back to home from game details', async ({ page }) => {
    await test.step('Navigate to game details page', async () => {
      await page.goto('/game/1');
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Click back to all games link', async () => {
      const backLink = page.getByRole('link', { name: /back to all games/i });
      await expect(backLink).toBeVisible();
      await backLink.click();
    });

    await test.step('Verify navigation back to homepage', async () => {
      await expect(page).toHaveURL('/');
      await expect(page.getByTestId('games-grid')).toBeVisible();
    });
  });

  test('should return a 404 page for a non-existent game', async ({ page }) => {
    let response: Response | null;

    await test.step('Navigate to non-existent game', async () => {
      response = await page.goto('/game/99999');
    });

    await test.step('Verify a branded 404 page is served', async () => {
      expect(response?.status()).toBe(404);
      await expect(page).toHaveTitle(/Page Not Found - Tailspin Toys/);
      await expect(page.getByTestId('not-found')).toBeVisible();
      await expect(page.getByTestId('not-found-heading')).not.toBeEmpty();
      await expect(page.getByTestId('not-found-home-link')).toBeVisible();
    });
  });

  test('should filter games by category', async ({ page }) => {
    let categoryId: string | null;
    let categoryName: string | null;

    await test.step('Navigate to homepage and capture a category', async () => {
      await page.goto('/');
      const firstGameCard = page.getByTestId('game-card').first();
      categoryId = await firstGameCard.getAttribute('data-category-id');
      categoryName = await firstGameCard.getAttribute('data-category-name');
      expect(categoryId).toBeTruthy();
      expect(categoryName).toBeTruthy();
    });

    await test.step('Apply the category filter', async () => {
      await page.getByTestId(`category-filter-${categoryId}`).check();
      await page.getByTestId('apply-filters-button').click();
      await expect(page).toHaveURL(new RegExp(`\\?category=${categoryId}$`));
    });

    await test.step('Verify only matching category cards are shown', async () => {
      expect(await visibleGameCardCount(page)).toBeGreaterThan(0);
      const visibleCategoryNames = await page.getByTestId('game-card').evaluateAll((cards) =>
        cards
          .filter((card) => !card.classList.contains('hidden'))
          .map((card) => card.getAttribute('data-category-name')),
      );
      expect(visibleCategoryNames.every((name) => name === categoryName)).toBe(true);
      await expect(page.getByTestId('filter-results-status')).toContainText('Showing');
    });
  });

  test('should filter games by publisher', async ({ page }) => {
    let publisherId: string | null;
    let publisherName: string | null;

    await test.step('Navigate to homepage and capture a publisher', async () => {
      await page.goto('/');
      const firstGameCard = page.getByTestId('game-card').first();
      publisherId = await firstGameCard.getAttribute('data-publisher-id');
      publisherName = await firstGameCard.getAttribute('data-publisher-name');
      expect(publisherId).toBeTruthy();
      expect(publisherName).toBeTruthy();
    });

    await test.step('Apply the publisher filter', async () => {
      await page.getByTestId('publisher-filter').selectOption(publisherId ?? '');
      await page.getByTestId('apply-filters-button').click();
      await expect(page).toHaveURL(new RegExp(`\\?publisher=${publisherId}$`));
    });

    await test.step('Verify only matching publisher cards are shown', async () => {
      expect(await visibleGameCardCount(page)).toBeGreaterThan(0);
      const visiblePublisherNames = await page.getByTestId('game-card').evaluateAll((cards) =>
        cards
          .filter((card) => !card.classList.contains('hidden'))
          .map((card) => card.getAttribute('data-publisher-name')),
      );
      expect(visiblePublisherNames.every((name) => name === publisherName)).toBe(true);
    });
  });

  test('should combine category and publisher filters', async ({ page }) => {
    let categoryId: string | null;
    let publisherId: string | null;

    await test.step('Navigate to homepage and capture matching filters', async () => {
      await page.goto('/');
      const firstGameCard = page.getByTestId('game-card').first();
      categoryId = await firstGameCard.getAttribute('data-category-id');
      publisherId = await firstGameCard.getAttribute('data-publisher-id');
      expect(categoryId).toBeTruthy();
      expect(publisherId).toBeTruthy();
    });

    await test.step('Apply both filters together', async () => {
      await page.getByTestId(`category-filter-${categoryId}`).check();
      await page.getByTestId('publisher-filter').selectOption(publisherId ?? '');
      await page.getByTestId('apply-filters-button').click();
      await expect(page).toHaveURL(new RegExp(`category=${categoryId}.*publisher=${publisherId}`));
    });

    await test.step('Verify visible cards match both filters', async () => {
      expect(await visibleGameCardCount(page)).toBeGreaterThan(0);
      const visibleCards = await page.getByTestId('game-card').evaluateAll((cards) =>
        cards
          .filter((card) => !card.classList.contains('hidden'))
          .map((card) => ({
            categoryId: card.getAttribute('data-category-id'),
            publisherId: card.getAttribute('data-publisher-id'),
          })),
      );
      expect(visibleCards.every((card) => card.categoryId === categoryId && card.publisherId === publisherId)).toBe(true);
    });
  });

  test('should clear selected filters', async ({ page }) => {
    await test.step('Navigate to a filtered games page', async () => {
      await page.goto('/');
      const firstCategoryId = await page.getByTestId('game-card').first().getAttribute('data-category-id');
      expect(firstCategoryId).toBeTruthy();
      await page.getByTestId(`category-filter-${firstCategoryId}`).check();
      await page.getByTestId('apply-filters-button').click();
      await expect(page).toHaveURL(new RegExp(`\\?category=${firstCategoryId}$`));
    });

    await test.step('Clear filters and verify all cards return', async () => {
      const totalCardCount = await page.getByTestId('game-card').count();
      await page.getByTestId('clear-filters-link').click();
      await expect(page).toHaveURL('/');
      expect(await visibleGameCardCount(page)).toBe(totalCardCount);
      await expect(page.getByTestId('filter-results-status')).toContainText('Showing all');
    });
  });
});
