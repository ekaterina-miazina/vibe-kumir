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
  await page.getByRole('button', { name: 'Запустить' }).click()
  await expect(page.locator('pre')).toContainText('done')
  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
})

test('edit mode supports direct field gestures and cancel rolls them back', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Редактировать обстановку' }).click()

  await expect(page.getByText('Левый клик по клетке: закрасить или снять закраску.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Закраска' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Положение робота' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Вертикальные стены' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Горизонтальные стены' })).toHaveCount(0)

  await page.getByLabel('Ширина').fill('4')
  await page.getByLabel('Высота').fill('3')
  await page.getByRole('button', { name: 'Применить размер' }).click()

  await expect(page.getByTestId('cell-3-2')).toBeVisible()
  await expect(page.getByTestId('cell-5-3')).toHaveCount(0)

  const originCell = page.getByTestId('cell-0-0')
  const robotCell = page.getByTestId('cell-2-1')

  await originCell.click()
  await expect(originCell).toHaveAttribute('data-painted', 'true')

  await robotCell.click({ button: 'right' })
  await expect(robotCell).toHaveAttribute('data-robot', 'true')

  await page.getByTestId('vwall-toggle-1-0').click()
  await page.getByTestId('hwall-toggle-0-1').click()
  await expect(originCell).toHaveAttribute('data-right-wall', 'true')
  await expect(originCell).toHaveAttribute('data-bottom-wall', 'true')

  await page.getByTestId('corner-dead-zone-0-0').click()
  await expect(originCell).toHaveAttribute('data-right-wall', 'true')
  await expect(originCell).toHaveAttribute('data-bottom-wall', 'true')

  await page.getByRole('button', { name: 'Отмена' }).click()

  await expect(page.getByRole('button', { name: 'Сохранить' })).toHaveCount(0)
  await expect(page.getByTestId('cell-5-3')).toBeVisible()
  await expect(originCell).toHaveAttribute('data-painted', 'false')
  await expect(originCell).toHaveAttribute('data-robot', 'true')
  await expect(robotCell).toHaveAttribute('data-robot', 'false')
  await expect(originCell).toHaveAttribute('data-right-wall', 'false')
  await expect(originCell).toHaveAttribute('data-bottom-wall', 'false')
})

test('save keeps resized world, walls, paint, and robot position', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Редактировать обстановку' }).click()

  await page.getByLabel('Ширина').fill('4')
  await page.getByLabel('Высота').fill('3')
  await page.getByRole('button', { name: 'Применить размер' }).click()

  const paintedCell = page.getByTestId('cell-1-1')
  const robotCell = page.getByTestId('cell-2-1')
  const originCell = page.getByTestId('cell-0-0')

  await paintedCell.click()
  await robotCell.click({ button: 'right' })
  await page.getByTestId('vwall-toggle-1-0').click()
  await page.getByTestId('hwall-toggle-0-1').click()

  await page.getByRole('button', { name: 'Сохранить' }).click()

  await expect(page.getByRole('button', { name: 'Редактировать обстановку' })).toBeVisible()
  await expect(page.getByTestId('cell-3-2')).toBeVisible()
  await expect(page.getByTestId('cell-5-3')).toHaveCount(0)
  await expect(paintedCell).toHaveAttribute('data-painted', 'true')
  await expect(robotCell).toHaveAttribute('data-robot', 'true')
  await expect(originCell).toHaveAttribute('data-right-wall', 'true')
  await expect(originCell).toHaveAttribute('data-bottom-wall', 'true')
})
