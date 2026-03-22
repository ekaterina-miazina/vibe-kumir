import { expect, test } from '@playwright/test'

test('app runs example without console errors', async ({ page }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'VibeKumir' })).toBeVisible()
  await page.getByRole('button', { name: 'Run' }).click()
  await expect(page.locator('pre')).toContainText('done')
  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
})
