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
