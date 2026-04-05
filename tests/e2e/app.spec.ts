import { expect, test } from '@playwright/test'

test('app runs example without console errors', async ({ page }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'ВайбКумир' })).toBeVisible()
  await page.getByRole('button', { name: 'Запустить' }).click()
  await expect(page.locator('pre')).toContainText('done')
  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
})

test('app follows the system theme when there is no saved preference', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem('vibe-kumir-theme')
  })

  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await page.emulateMedia({ colorScheme: 'light' })
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('saved theme preference persists and overrides the system theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')

  const themeSelect = page.getByLabel('Тема оформления')
  await themeSelect.selectOption('light')

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  expect(await page.evaluate(() => window.localStorage.getItem('vibe-kumir-theme'))).toBe('light')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

  await themeSelect.selectOption('system')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await page.evaluate(() => window.localStorage.getItem('vibe-kumir-theme'))).toBe('system')
})

test('theme switching keeps the main workflow usable', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Тема оформления').selectOption('light')

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.getByTestId('world-grid')).toBeVisible()

  await page.getByRole('button', { name: 'Запустить' }).click()
  await expect(page.locator('pre')).toContainText('done')
})

test('editor shows line numbers and parse errors include the source line', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByTestId('editor-line-number')).toHaveCount(10)
  await expect(page.getByTestId('editor-line-number').first()).toHaveText('1')
  await expect(page.getByTestId('editor-line-number').last()).toHaveText('10')

  await page.getByTestId('code-editor').fill(`использовать Робот
алг test
нач
  прыжок
кон`)

  await expect(page.getByTestId('editor-error-underline')).toHaveText('прыжок')
  await expect(page.getByText('Строка 4: Неизвестная команда: прыжок')).toBeVisible()
})

test('editor auto-indents new lines and supports shift+tab', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByTestId('code-editor')
  await editor.fill(`использовать Робот
алг test
нач`)
  await editor.press('End')
  await editor.press('Enter')

  await expect(editor).toHaveValue(`использовать Робот
алг test
нач
  `)

  await page.keyboard.type('если клетка чистая то')
  await editor.press('Enter')
  await expect(editor).toHaveValue(`использовать Робот
алг test
нач
  если клетка чистая то
    `)

  await page.keyboard.type('закрасить')
  await editor.press('Enter')
  await page.keyboard.type('все')
  await editor.press('Enter')
  await expect(editor).toHaveValue(`использовать Робот
алг test
нач
  если клетка чистая то
    закрасить
  все
  `)

  await editor.press('Tab')
  await page.keyboard.type('вправо')
  await editor.press('Shift+Tab')

  await expect(editor).toHaveValue(`использовать Робот
алг test
нач
  если клетка чистая то
    закрасить
  все
  вправо`)
})

test('editor overlay stays in sync with textarea scrolling', async ({ page }) => {
  await page.goto('/')

  await page.getByTestId('code-editor').fill(`использовать Робот
алг test
нач
${Array.from({ length: 40 }, () => `${' '.repeat(80)}закрасить`).join('\n')}
кон`)

  const scrollState = await page.getByTestId('code-editor').evaluate((element: HTMLTextAreaElement) => {
    element.scrollTop = 180
    element.scrollLeft = 120
    element.dispatchEvent(new Event('scroll'))
    return { top: element.scrollTop, left: element.scrollLeft }
  })

  await expect(page.getByTestId('editor-line-numbers-content')).toHaveAttribute(
    'style',
    new RegExp(`translateY\\(-${scrollState.top}px\\)`),
  )
  await expect(page.getByTestId('editor-overlay-content')).toHaveAttribute(
    'style',
    new RegExp(`translate\\(-${scrollState.left}px, -${scrollState.top}px\\)`),
  )
})

test('runtime errors include the source line', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('code-editor').fill(`использовать Робот
алг test
нач
  нц 2 раз
    влево
  кц
кон`)

  await page.getByRole('button', { name: 'Запустить' }).click()

  await expect(page.getByText('Строка 5: collision with obstacle')).toBeVisible()
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

test('field zoom changes visible cell size', async ({ page }) => {
  await page.goto('/')

  const cell = page.getByTestId('cell-0-0')
  const initialWidth = await cell.evaluate((element) => element.getBoundingClientRect().width)

  await page.getByRole('button', { name: 'Увеличить масштаб поля' }).click()
  await page.getByRole('button', { name: 'Увеличить масштаб поля' }).click()

  await expect(page.getByTestId('world-zoom-value')).toHaveText('120%')

  const zoomedWidth = await cell.evaluate((element) => element.getBoundingClientRect().width)
  expect(zoomedWidth).toBeGreaterThan(initialWidth)

  await page.getByRole('button', { name: '100%' }).click()
  await expect(page.getByTestId('world-zoom-value')).toHaveText('100%')
})
