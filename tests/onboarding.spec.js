import { expect, test } from '@playwright/test';

test('opens login from the Lithuania experience page', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Explore Lithuania' }).click();
  await expect(page.getByRole('heading', { name: 'See Lithuania through people who actually live here.' })).toBeVisible();

  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

  await page.getByRole('button', { name: '×' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeHidden();
});

test('requires login before submitting a contribution', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Explore Lithuania' }).click();
  await page.getByRole('button', { name: 'Become a contributor' }).click();
  await expect(page.getByRole('heading', { name: 'Share your experience' })).toBeVisible();

  await page.getByLabel('Story title').fill('A useful moving tip');
  await page.getByLabel('Tell us your experience').fill('A practical tip for someone arriving in Lithuania.');
  await page.getByRole('button', { name: 'Submit contribution' }).click();

  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});
