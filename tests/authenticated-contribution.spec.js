import { expect, test } from '@playwright/test';

const testEmail = process.env.TEST_USER_EMAIL;
const testPassword = process.env.TEST_USER_PASSWORD;

test('authenticated user can create and delete a contribution', async ({ page }) => {
  test.skip(!testEmail || !testPassword, 'Set TEST_USER_EMAIL and TEST_USER_PASSWORD for authenticated tests.');

  await page.goto('/');
  await page.getByRole('button', { name: 'Explore Lithuania' }).click();
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByLabel('Email').fill(testEmail);
  await page.getByLabel('Password').fill(testPassword);
  await page.getByRole('button', { name: 'Log in' }).last().click();

  await expect(page.getByRole('heading', { name: /Welcome back,/ })).toBeVisible();

  await page.getByRole('button', { name: 'Become a contributor' }).click();
  const title = `Automated test story ${Date.now()}`;
  await page.getByLabel('Story title').fill(title);
  await page.getByLabel('Tell us your experience').fill('Created by the authenticated Playwright smoke test.');
  await page.getByRole('button', { name: 'Submit contribution' }).click();

  await expect(page.getByText('Your post was uploaded successfully.')).toBeVisible();
  await expect(page.getByText(title)).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete' }).last().click();
  await expect(page.getByText('Your post was deleted.')).toBeVisible();
  await expect(page.getByText(title)).toBeHidden();
});
