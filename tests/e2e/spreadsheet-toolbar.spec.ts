/**
 * Isolated fixture only. Requires playwright.spreadsheet.config.ts
 * (VITE_SPREADSHEET_FIXTURE=true). It does not read or write real product records.
 */
import { expect, test, type Page } from '@playwright/test'

async function signIn(page: Page) {
  await page.goto('/#/login')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByLabel('Email').fill('admin@example.com')
  await page.locator('input[name="password"]').fill('password')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
}

test('fixture product edits, formats, saves, and reloads', async ({ page }) => {
  await signIn(page)
  await page.evaluate(() => {
    localStorage.setItem('gxp.cpv.product-profile.v1', JSON.stringify({
      'REAL-PRODUCT:raw-material': {
        id: 'decoy',
        name: 'Decoy',
        activeSheetId: 'decoy-sheet',
        sheets: [{ id: 'decoy-sheet', name: 'Sheet', rowCount: 100, columnCount: 26, cells: { '0:0': 'DO-NOT-TOUCH' } }],
      },
    }))
  })
  await page.goto('/#/cpv/products')
  const product = page.locator('a.cpv-sheet-name-button', { hasText: 'Spreadsheet Fixture' })
  await expect(product).toBeVisible()
  const popupPromise = page.waitForEvent('popup')
  await product.click()
  const sheet = await popupPromise
  await sheet.waitForLoadState('domcontentloaded')
  await expect(sheet.locator('.eq-gtoolbar')).toBeVisible()
  await expect(sheet.locator('.eq-cell.is-active .eq-cell-value')).toHaveText('2')

  const cell = sheet.locator('.eq-cell').first()
  await cell.dblclick()
  const editor = sheet.locator('.eq-editor')
  await editor.fill('Align me')
  await editor.press('Enter')
  await sheet.locator('.eq-cell', { hasText: 'Align me' }).click()

  await sheet.getByTitle('Horizontal alignment menu').click()
  await sheet.getByRole('button', { name: 'Center' }).click()
  await expect(sheet.locator('.eq-cell.is-active .eq-cell-value')).toHaveCSS('text-align', 'center')

  await sheet.getByTitle('Fill color menu').click()
  await sheet.getByRole('button', { name: '#e53935' }).click()
  await expect(sheet.locator('.eq-cell.is-active')).toHaveCSS('background-color', 'rgb(229, 57, 53)')

  await expect(sheet.locator('.eq-save-state')).toHaveText('Saved')
  const stored = await sheet.evaluate(() => localStorage.getItem('gxp.cpv.product-profile.v1') ?? '')
  expect(stored).toContain('DO-NOT-TOUCH')
  expect(stored).toContain('ZZ-SHEET-FIXTURE:raw-material')
  await sheet.reload()
  await expect(sheet.locator('.eq-gtoolbar')).toBeVisible()
  await expect(sheet.locator('.eq-cell.is-active .eq-cell-value')).toHaveText('Align me')
  await expect(sheet.locator('.eq-cell.is-active .eq-cell-value')).toHaveCSS('text-align', 'center')
  await expect(sheet.locator('.eq-cell.is-active')).toHaveCSS('background-color', 'rgb(229, 57, 53)')
})
