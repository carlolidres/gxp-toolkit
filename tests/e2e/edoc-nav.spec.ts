import { expect, test } from '@playwright/test'

test('eDoc dashboard is reachable in mock mode', async ({ page }) => {
  await page.goto('/#/login')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByLabel('Email').fill('admin@example.com')
  await page.locator('input[name="password"]').fill('password')
  await page.getByRole('button', { name: /sign in/i }).click()

  await expect(page.getByText('Mock data environment')).toBeVisible({ timeout: 15_000 })
  await page.goto('/#/edoc')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('main').getByRole('link', { name: 'Create Document' })).toBeVisible()
})
