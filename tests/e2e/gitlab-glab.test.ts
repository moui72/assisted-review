import { test, expect } from '@playwright/test';

test.beforeEach(async ({ request }) => {
  await request.delete('/api/reviews/gitlab/testgroup/testrepo/42');
  await request.delete('/api/review');
});

test('open a GitLab MR and submit a comment review', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');

  // Open the stub MR using the GitLab ! shorthand
  await page.getByPlaceholder('owner/repo#123 or PR URL').fill('testgroup/testrepo!42');
  await page.getByRole('button', { name: 'Open' }).click();

  // Wait for the review to load
  await expect(page.getByRole('heading', { name: 'E2E Test MR' })).toBeVisible({ timeout: 15000 });

  // Navigate to the first chunk
  await page.getByRole('button', { name: /Go to chunk 1/ }).click();

  // Diff content from the stub should be visible
  await expect(page.getByText('helper.rb')).toBeVisible();

  // Open submit modal — default verdict for GitLab is 'comment'
  await page.getByRole('button', { name: 'Submit' }).click();

  // Fill in a summary body (required for comment verdict with no inline comments)
  await page.getByPlaceholder('Overall review comment…').fill('Looks good overall.');

  // Submit
  await page.getByRole('button', { name: /Submit as Comment/ }).click();

  // Success state — html_url comes from review.meta.url injected by the server
  await expect(page.getByText('Review submitted')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('link', { name: /View on GitLab/ })).toBeVisible();

  expect(errors, 'uncaught JS errors').toEqual([]);
});

test('open a GitLab MR and submit an approval', async ({ page }) => {
  await page.goto('/');

  await page.getByPlaceholder('owner/repo#123 or PR URL').fill('testgroup/testrepo!42');
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.getByRole('heading', { name: 'E2E Test MR' })).toBeVisible({ timeout: 15000 });

  await page.getByRole('button', { name: 'Submit' }).click();

  // Switch to the approve verdict
  await page.getByRole('button', { name: /Sign off on the changes/ }).click();

  // No body required for approval
  await page.getByRole('button', { name: /Submit as Approve/ }).click();

  await expect(page.getByText('Review submitted')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('link', { name: /View on GitLab/ })).toBeVisible();
});
