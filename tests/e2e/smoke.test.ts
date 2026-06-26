import { test, expect } from '@playwright/test';

test.beforeEach(async ({ request }) => {
  await request.delete('/api/review'); // ensure no review is active so splash shows
});

test('app renders without crashing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');

  // Splash input is the first interactive element when no review is loaded
  await expect(
    page.getByPlaceholder('owner/repo#123 or PR URL'),
  ).toBeVisible();

  expect(errors, 'uncaught JS errors on load').toEqual([]);
});
