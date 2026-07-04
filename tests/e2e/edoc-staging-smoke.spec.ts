import { expect, test } from '@playwright/test'

import { appPath, signIn, STAGING_EDOC } from './helpers/staging-edoc-auth'

const reviewerReady = Boolean(STAGING_EDOC.reviewer.password)
const creatorReady = Boolean(STAGING_EDOC.creator.password)

test.describe('eDoc Phase 4 — staging smoke (disposable test accounts)', () => {
  test.beforeEach(({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`[browser console] ${msg.text()}`)
      }
    })
  })

  test('Reviewer — inbox shows staging assignment', async ({ page }) => {
    test.skip(!reviewerReady, 'Set E2E_EDOC_TEST_PASSWORD after provisioning test accounts')
    await signIn(page, STAGING_EDOC.reviewer.email, STAGING_EDOC.reviewer.password)

    await page.getByRole('button', { name: 'eDoc' }).click()
    await page.getByRole('link', { name: 'My Inbox' }).click()
    await expect(page.getByRole('heading', { name: 'My Inbox' })).toBeVisible()
    await expect(page.getByText('EDOC-STAGING-001')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('link', { name: 'Open' }).first()).toBeVisible()
  })

  test('Reviewer — cannot open Create Document (permission denied)', async ({ page }) => {
    test.skip(!reviewerReady, 'Set E2E_EDOC_TEST_PASSWORD after provisioning test accounts')
    await signIn(page, STAGING_EDOC.reviewer.email, STAGING_EDOC.reviewer.password)

    await page.goto(appPath('/edoc/create'))
    await expect(page.getByRole('heading', { name: 'Create Document' })).not.toBeVisible()
    await expect(page).not.toHaveURL(/\/edoc\/create/)
  })

  test('Creator — Create Document wizard loads', async ({ page }) => {
    test.skip(!creatorReady, 'Set E2E_EDOC_TEST_PASSWORD after provisioning test accounts')
    await signIn(page, STAGING_EDOC.creator.email, STAGING_EDOC.creator.password)

    await page.getByRole('button', { name: 'eDoc' }).click()
    await page.getByRole('link', { name: 'Create Document' }).click()
    await expect(page.getByRole('heading', { name: 'Create Document' })).toBeVisible()
    await expect(page.getByText('Metadata', { exact: true })).toBeVisible()
    await expect(page.getByLabel(/document number/i)).toBeVisible()
  })

  test('Creator — dashboard and inbox reachable', async ({ page }) => {
    test.skip(!creatorReady, 'Set E2E_EDOC_TEST_PASSWORD after provisioning test accounts')
    await signIn(page, STAGING_EDOC.creator.email, STAGING_EDOC.creator.password)

    await page.goto(appPath('/edoc'))
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await page.goto(appPath('/edoc/inbox'))
    await expect(page.getByRole('heading', { name: 'My Inbox' })).toBeVisible()
  })
})
