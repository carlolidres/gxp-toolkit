import { expect, test, type Page } from '@playwright/test'

async function openFixture(page: Page) {
  await page.goto('/#/login')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByLabel('Email').fill('admin@example.com')
  await page.locator('input[name="password"]').fill('password')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
  await page.goto('/#/cpv/products/ZZ-SHEET-FIXTURE/profile/raw-material')
  await expect(page.locator('.eq-gtoolbar')).toBeVisible()
  await expect(page.locator('.eq-cell.is-active .eq-cell-value')).toHaveText('2')
}

test('coordinates stay correct after scroll, zoom, freeze, resize, and sheet switch', async ({ page }) => {
  await openFixture(page)

  const header = page.locator('.eq-row-header').first()
  const before = await header.evaluate((node) => node.getBoundingClientRect().height)
  const box = await header.locator('.eq-resize').boundingBox()
  expect(box).not.toBeNull()
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + 48)
    await page.mouse.up()
  }
  await expect.poll(async () => header.evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThan(before + 10)

  const name = page.getByLabel('Name Box')
  await name.fill('C3')
  await name.press('Enter')
  await expect(name).toHaveValue('C3')

  const scrolledHeader = page.locator('.eq-row-header').nth(6)
  const beforeScroll = await scrolledHeader.innerText()
  await page.locator('.eq-grid').hover()
  await page.mouse.wheel(0, 900)
  await expect.poll(async () => scrolledHeader.innerText()).not.toBe(beforeScroll)
  await expect(name).toHaveValue('C3')
  await page.mouse.wheel(900, 0)
  await expect(name).toHaveValue('C3')

  await page.getByTitle('Zoom').click()
  await page.getByRole('button', { name: '150%', exact: true }).click()
  await expect(page.locator('.eq-body')).toHaveCSS('zoom', '1.5')
  await expect(name).toHaveValue('C3')

  await page.getByRole('menuitem', { name: 'View' }).click()
  await page.getByRole('button', { name: 'Freeze top row' }).click()
  await page.locator('.eq-grid').hover()
  await page.mouse.wheel(0, 1400)
  await expect(page.locator('.eq-row-header', { hasText: /^1$/ })).toBeVisible()

  await page.getByRole('tab', { name: 'Notes' }).click()
  await page.getByLabel('Name Box').fill('A1')
  await page.getByLabel('Name Box').press('Enter')
  await expect(page.locator('.eq-cell.is-active .eq-cell-value')).toHaveText('Notes')

  await page.getByRole('tab', { name: 'Data' }).click()
  await page.getByLabel('Name Box').fill('A1')
  await page.getByLabel('Name Box').press('Enter')
  await expect(page.locator('.eq-cell.is-active .eq-cell-value')).toHaveText('2')

  await page.getByLabel('Name Box').fill('XFD1048576')
  await page.getByLabel('Name Box').press('Enter')
  await expect(page.getByLabel('Name Box')).toHaveValue('XFD1048576')
  await expect(page.locator('.eq-col-header', { hasText: 'XFD' })).toBeVisible()
  await expect(page.locator('.eq-row-header', { hasText: '1048576' })).toBeVisible()
})
