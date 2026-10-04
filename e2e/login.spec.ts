import { expect, test } from '@playwright/test';

test('login screen opens registration and lists teams', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ретроспектива' })).toBeVisible();

  await page.getByRole('tab', { name: 'Регистрация' }).click();
  await expect(page.getByLabel('Имя')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Создать учетку' })).toBeVisible();

  await page.getByRole('tab', { name: 'Вход' }).click();
  await expect(page.getByRole('heading', { name: 'Карты и Партнеры' })).toBeVisible();
});
