import { test, expect } from '@playwright/test';

test.beforeEach(async ({ request }) => {
  // Remove any state file from a prior run so this test always starts fresh.
  await request.delete('/api/reviews/github/testowner/testrepo/42');
  await request.delete('/api/review');
});

test('app renders and shows splash', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  await expect(page.getByPlaceholder('owner/repo#123 or PR URL')).toBeVisible();
  expect(errors, 'uncaught JS errors on load').toEqual([]);
});

test('open a GitHub PR and submit an approval', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');

  // Open the stub PR
  await page.getByPlaceholder('owner/repo#123 or PR URL').fill('testowner/testrepo#42');
  await page.getByRole('button', { name: 'Open' }).click();

  // Wait for the review to load — title appears in the top nav
  await expect(page.getByRole('heading', { name: 'E2E Test PR' })).toBeVisible({ timeout: 15000 });

  // Navigate to the first chunk via the tick strip
  await page.getByRole('button', { name: /Go to chunk 1/ }).click();

  // Diff content from the stub should be visible
  await expect(page.getByText('app.ts')).toBeVisible();

  // Open the submit modal
  await page.getByRole('button', { name: 'Submit' }).click();

  // Switch verdict to Approve
  await page.getByRole('button', { name: /Sign off on the changes/ }).click();

  // Submit
  await page.getByRole('button', { name: /Submit as Approve/ }).click();

  // Success state
  await expect(page.getByText('Review submitted')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('link', { name: /View on GitHub/ })).toBeVisible();

  expect(errors, 'uncaught JS errors').toEqual([]);
});

test('shows an error when the server rejects the review', async ({ page }) => {
  await page.goto('/');

  await page.getByPlaceholder('owner/repo#123 or PR URL').fill('testowner/testrepo#42');
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.getByRole('heading', { name: 'E2E Test PR' })).toBeVisible({ timeout: 15000 });

  // Open submit modal and try to submit with COMMENT but no body and no inline
  // comments — the server should reject it as a no-op.
  await page.getByRole('button', { name: 'Submit' }).click();
  // Default verdict is COMMENT; leave body empty
  await page.getByRole('button', { name: /Submit as Comment/ }).click();

  await expect(page.getByText(/nothing to submit/i)).toBeVisible({ timeout: 10000 });
});
