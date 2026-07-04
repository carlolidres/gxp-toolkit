import { expect, type Page } from '@playwright/test'

/** Disposable staging test accounts — see docs/edoc/STAGING_TEST_ACCOUNTS.md */
export const STAGING_EDOC = {
  reviewer: {
    email: process.env.E2E_EDOC_REVIEWER_EMAIL ?? 'edoc-reviewer@example.test',
    password: process.env.E2E_EDOC_REVIEWER_PASSWORD ?? process.env.E2E_EDOC_TEST_PASSWORD ?? '',
  },
  creator: {
    email: process.env.E2E_EDOC_CREATOR_EMAIL ?? 'edoc-creator@example.test',
    password: process.env.E2E_EDOC_CREATOR_PASSWORD ?? process.env.E2E_EDOC_TEST_PASSWORD ?? '',
  },
} as const

export function appPath(route: string): string {
  const base = (process.env.VITE_BASE_PATH ?? './').replace(/\/$/, '')
  const normalizedRoute = route.startsWith('/') ? route : `/${route}`
  if (!base || base === '.' || base === './') {
    return `/#${normalizedRoute}`
  }
  return `${base}/#${normalizedRoute}`
}

export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto(appPath('/login'))
  await page.evaluate(() => {
    sessionStorage.clear()
    localStorage.clear()
  })
  await page.reload()
  await page.getByLabel('Email').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page.getByText('Supabase live backend')).toBeVisible({ timeout: 20_000 })
}
