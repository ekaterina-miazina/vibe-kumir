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
  await expect(page.getByTestId('runtime-log')).toContainText('done')
  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
})

test('documentation page opens, copies examples, and returns to the main screen', async ({ page }) => {
  await page.addInitScript(() => {
    let copiedText = ''
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          copiedText = value
        },
      },
    })
    ;(window as Window & { __copiedExample?: () => string }).__copiedExample = () => copiedText
  })

  await page.goto('/')
  await page.getByTestId('open-docs-link').click()

  await expect(page).toHaveURL(/#docs$/)
  await expect(page.getByRole('heading', { name: 'Документация по языку' })).toBeVisible()
  await expect(page.getByText('Поддерживаемые инструкции')).toBeVisible()
  await expect(page.getByTestId('docs-example-move-to-wall')).toBeVisible()

  await page.reload()
  await expect(page).toHaveURL(/#docs$/)
  await expect(page.getByRole('heading', { name: 'Документация по языку' })).toBeVisible()

  await page.getByTestId('copy-example-move-to-wall').click()
  await expect(page.getByTestId('copy-example-move-to-wall')).toHaveText('Скопировано')
  await expect
    .poll(() => page.evaluate(() => (window as Window & { __copiedExample?: () => string }).__copiedExample?.() ?? ''))
    .toContain(`алг до_стены`)

  await page.getByTestId('back-to-main-link').click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'ВайбКумир' })).toBeVisible()
  await page.getByRole('button', { name: 'Запустить' }).click()
  await expect(page.getByTestId('runtime-log')).toContainText('done')
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
  await expect(page.getByTestId('runtime-log')).toContainText('done')
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

test('field background can be previewed, saved, and reset to the theme color', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Тема оформления').selectOption('light')

  const cell = page.getByTestId('cell-0-0')
  const backgroundInput = page.getByLabel('Фон поля')

  await expect(cell).toHaveCSS('background-color', 'rgb(247, 251, 255)')

  await page.getByRole('button', { name: 'Редактировать обстановку' }).click()
  await backgroundInput.evaluate((element: HTMLInputElement, value: string) => {
    element.value = value
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  }, '#c8facc')

  await expect(cell).toHaveCSS('background-color', 'rgb(200, 250, 204)')

  await page.getByRole('button', { name: 'Сохранить' }).click()
  await expect(cell).toHaveCSS('background-color', 'rgb(200, 250, 204)')

  await page.getByRole('button', { name: 'Редактировать обстановку' }).click()
  await page.getByRole('button', { name: 'По теме' }).click()
  await expect(cell).toHaveCSS('background-color', 'rgb(247, 251, 255)')

  await page.getByRole('button', { name: 'Сохранить' }).click()
  await expect(cell).toHaveCSS('background-color', 'rgb(247, 251, 255)')
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

test('main screen fits mobile viewport without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const layout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    appShellWidth: document.querySelector('.app-shell')?.getBoundingClientRect().width ?? 0,
    headerWidth: document.querySelector('header')?.getBoundingClientRect().width ?? 0,
    mainWidth: document.querySelector('main')?.getBoundingClientRect().width ?? 0,
  }))

  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1)
  expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth + 1)
  expect(layout.headerWidth).toBeLessThanOrEqual(layout.appShellWidth + 1)
  expect(layout.mainWidth).toBeLessThanOrEqual(layout.appShellWidth + 1)
  await expect(page.getByRole('button', { name: 'Запустить' })).toBeVisible()
})
