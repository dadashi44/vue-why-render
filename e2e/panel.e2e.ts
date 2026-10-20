import { expect, test } from '@playwright/test'
import type { FrameLocator, Page } from '@playwright/test'

// Локаторы Playwright проходят сквозь открытый shadow DOM — панель живёт именно там.
const panel = (page: Page) => page.locator('[data-vue-why-render="panel"] .vwr')
const head = (page: Page) => panel(page).locator('.vwr__head')
// Кнопки тулбара — иконки, поэтому ищем по доступному имени, а не по видимому тексту.
const button = (page: Page, name: string) => panel(page).locator('.vwr__toolbar').getByRole('button', { name, exact: true })

async function open(page: Page, query = ''): Promise<void> {
    await page.goto(`/${query}`)
    await expect(panel(page)).toBeVisible()
}

test.describe('перетаскивание', () => {
    test('панель едет за шапкой, не сворачивается и встаёт на место после перезагрузки', async ({ page }) => {
        await open(page)
        const before = (await panel(page).boundingBox())!
        const grip = (await head(page).boundingBox())!

        const start = { x: grip.x + 20, y: grip.y + grip.height / 2 }
        await page.mouse.move(start.x, start.y)
        await page.mouse.down()
        await page.mouse.move(start.x - 320, start.y - 200, { steps: 8 })
        await page.mouse.up()

        const after = (await panel(page).boundingBox())!
        expect(after.x).toBeCloseTo(before.x - 320, 0)
        expect(after.y).toBeCloseTo(before.y - 200, 0)
        // Отпускание после переноса браузер считает кликом — панель не должна свернуться.
        await expect(panel(page).locator('.vwr__body')).toBeVisible()

        await page.reload()
        await expect(panel(page)).toBeVisible()
        const restored = (await panel(page).boundingBox())!
        expect(restored.x).toBeCloseTo(after.x, 0)
        expect(restored.y).toBeCloseTo(after.y, 0)
    })

    test('не уходит за край окна', async ({ page }) => {
        await open(page)
        const grip = (await head(page).boundingBox())!
        await page.mouse.move(grip.x + 20, grip.y + 5)
        await page.mouse.down()
        await page.mouse.move(-500, -500, { steps: 5 })
        await page.mouse.up()

        const box = (await panel(page).boundingBox())!
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.y).toBeGreaterThanOrEqual(0)
    })

    test('клик без переноса сворачивает, как и раньше', async ({ page }) => {
        await open(page)
        await head(page).click()
        await expect(panel(page).locator('.vwr__body')).toBeHidden()
    })
})

test.describe('горячая клавиша', () => {
    test('Alt+Shift+P ставит запись на паузу и снимает с неё', async ({ page }) => {
        await open(page)
        const pause = panel(page).locator('.vwr__toolbar .vwr__btn').first()
        await expect(pause).toHaveAttribute('aria-label', 'recording')

        await page.keyboard.press('Alt+Shift+KeyP')
        await expect(pause).toHaveAttribute('aria-label', 'paused')

        // На паузе рендеры не считаются.
        const badge = panel(page).locator('.vwr__badge')
        const counted = await badge.textContent()
        await page.click('#bump')
        await page.waitForTimeout(400)
        await expect(badge).toHaveText(counted!)

        await page.keyboard.press('Alt+Shift+KeyP')
        await expect(pause).toHaveAttribute('aria-label', 'recording')
        await page.click('#bump')
        await expect(badge).not.toHaveText(counted!)
    })

    test('гасит нажатие, чтобы в поле под фокусом не напечатался символ', async ({ page }) => {
        await open(page)
        // Вставит ли браузер «∏» в поле, зависит от ОС и раскладки, и Playwright
        // при зажатом Alt символ не вставляет вовсе — проверка по значению поля
        // проходила бы и без защиты. Поэтому проверяем саму защиту: слушатель,
        // добавленный после нашего, видит уже погашенное событие.
        await page.evaluate(() => {
            window.addEventListener('keydown', (event) => {
                if (event.code === 'KeyP') (window as { prevented?: boolean }).prevented = event.defaultPrevented
            })
        })
        await panel(page).locator('.vwr__search').click()
        await page.keyboard.press('Alt+Shift+KeyP')
        expect(await page.evaluate(() => (window as { prevented?: boolean }).prevented)).toBe(true)
        await expect(panel(page).locator('.vwr__search')).toHaveValue('')
    })
})

test.describe('открытие отчёта', () => {
    async function savedReport(page: Page): Promise<string> {
        await page.click('#add')
        await expect(panel(page)).toContainText('store cart.items')
        return page.evaluate(() => JSON.stringify(window.__VUE_WHY_RENDER__!.getReport()))
    }

    test('через кнопку: настоящий выбор файла и возврат к живой сессии', async ({ page }) => {
        await open(page)
        const json = await savedReport(page)
        await page.reload()

        await panel(page).locator('input[type="file"]').setInputFiles({
            name: 'report.json',
            mimeType: 'application/json',
            buffer: Buffer.from(json),
        })

        const banner = panel(page).locator('.vwr__banner')
        await expect(banner).toContainText('report · ')
        await expect(panel(page)).toContainText('store cart.items (add) · action add()')
        await expect(button(page, 'recording')).toHaveCount(0)

        await banner.locator('.vwr__btn').click()
        await expect(banner).toBeHidden()
        await expect(button(page, 'recording')).toBeVisible()
    })

    test('перетаскиванием файла на панель', async ({ page }) => {
        await open(page)
        const json = await savedReport(page)

        // Нативный drag-and-drop из ОС Playwright не умеет — бросаем DataTransfer
        // с настоящим File, как это делает браузер.
        const transfer = await page.evaluateHandle((text) => {
            const data = new DataTransfer()
            data.items.add(new File([text], 'report.json', { type: 'application/json' }))
            return data
        }, json)
        await panel(page).dispatchEvent('dragover', { dataTransfer: transfer })
        await expect(panel(page)).toHaveClass(/vwr--dropping/)
        await panel(page).dispatchEvent('drop', { dataTransfer: transfer })

        await expect(panel(page).locator('.vwr__banner')).toBeVisible()
        await expect(panel(page)).not.toHaveClass(/vwr--dropping/)
    })

    test('битый файл — строка с ошибкой, живая сессия на месте', async ({ page }) => {
        await open(page)
        await panel(page).locator('input[type="file"]').setInputFiles({
            name: 'broken.json',
            mimeType: 'application/json',
            buffer: Buffer.from('{ not json'),
        })
        await expect(panel(page).locator('.vwr__error')).toContainText('Could not open the report')
        await expect(panel(page).locator('.vwr__banner')).toBeHidden()
    })
})

test.describe('буфер обмена', () => {
    test.use({ permissions: ['clipboard-read', 'clipboard-write'] })
    // Буфер обмена у браузера общий на всю систему: параллельные тесты
    // перезаписывали бы друг другу текст, и падал бы то один, то другой.
    test.describe.configure({ mode: 'serial' })

    const clipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText())

    test('кнопка у строки копирует причину', async ({ page }) => {
        await open(page)
        await page.click('#bump')
        const row = panel(page).locator('li', { hasText: 'Counter' })
        await expect(row).toContainText('prop count: 0 → 1')

        await row.locator('button.vwr__copy').click()
        await expect(row.locator('button.vwr__copy')).toHaveText('✓')
        const text = await clipboard(page)
        // Время необязательно: рендер Counter настолько быстрый, что Chromium с его
        // загрублённым performance.now() иногда меряет 0 — и тогда «0ms» не пишется.
        expect(text).toMatch(/^Counter ×1(?: · [\d.]+ms)? · fixture\/Counter\.vue\n└─ prop count: 0 → 1$/)
    })

    test('md копирует отчёт Markdown-ом', async ({ page }) => {
        await open(page)
        await page.click('#add')
        await expect(panel(page)).toContainText('store cart.items')

        await button(page, 'copy the report as Markdown for an issue').click()
        const text = await clipboard(page)
        expect(text).toContain('### vue-why-render report')
        expect(text).toContain('`store cart.items (add) · action add()`')
        expect(text).not.toContain('localhost')
    })
})

test.describe('тема', () => {
    const background = (page: Page) => panel(page).evaluate(element => getComputedStyle(element).backgroundColor)

    test('auto следует prefers-color-scheme', async ({ page }) => {
        await page.emulateMedia({ colorScheme: 'light' })
        await open(page)
        expect(await background(page)).toBe('rgb(255, 255, 255)')

        await page.emulateMedia({ colorScheme: 'dark' })
        expect(await background(page)).toBe('rgb(22, 24, 29)')
    })

    test('явная тема сильнее системной', async ({ page }) => {
        await page.emulateMedia({ colorScheme: 'light' })
        await open(page, '?theme=dark')
        expect(await background(page)).toBe('rgb(22, 24, 29)')
    })
})

test.describe('бюджеты', () => {
    // Тот же сценарий, что в README в разделе «Failing CI», — пример должен работать.
    test('нарушение видно через window.__VUE_WHY_RENDER__ и красным счётчиком', async ({ page }) => {
        await open(page, '?budget=2')
        const warnings: string[] = []
        page.on('console', (message) => {
            if (message.type() === 'warning') warnings.push(message.text())
        })

        for (let i = 0; i < 4; i++) await page.click('#bump')

        const violations = await page.evaluate(() => window.__VUE_WHY_RENDER__?.getViolations() ?? [])
        expect(violations.map(item => item.name)).toContain('Counter')
        await expect(panel(page).locator('li', { hasText: 'Counter' }).locator('.vwr__count')).toHaveClass(/vwr__count--over/)
        expect(warnings.some(text => text.includes('budget exceeded: Counter'))).toBe(true)
    })

    test('без бюджета нарушений нет', async ({ page }) => {
        await open(page)
        for (let i = 0; i < 4; i++) await page.click('#bump')
        const violations = await page.evaluate(() => window.__VUE_WHY_RENDER__?.getViolations() ?? [])
        expect(violations).toEqual([])
    })
})

test.describe('вкладка Nuxt DevTools', () => {
    // Как в DevTools: вкладка — iframe внутри iframe DevTools, внутри страницы приложения.
    async function openTab(page: Page): Promise<FrameLocator> {
        await page.evaluate(() => {
            const outer = document.createElement('iframe')
            outer.id = 'devtools'
            // Ниже контента стенда — иначе iframe перекрыл бы кнопки, по которым кликает тест.
            Object.assign(outer.style, { position: 'fixed', left: '0', top: '200px', width: '720px', height: '420px' })
            outer.srcdoc = '<html style="height:100%"><body style="margin:0;height:100%">'
                + '<iframe src="/__vue-why-render/devtools" style="width:100%;height:100%;border:0;display:block"></iframe></body></html>'
            document.body.appendChild(outer)
        })
        return page.frameLocator('#devtools').frameLocator('iframe')
    }

    test('показывает живую панель приложения на всю вкладку', async ({ page }) => {
        await open(page)
        const tab = await openTab(page)
        const embedded = tab.locator('[data-vue-why-render="panel-embedded"] .vwr')
        await expect(embedded).toBeVisible()
        await expect(embedded).toHaveClass(/vwr--embedded/)

        // Данные — тот же живой реестр: рендер в приложении виден во вкладке.
        await page.click('#bump')
        await expect(embedded.locator('li', { hasText: 'Counter' })).toContainText('prop count: 0 → 1')

        const box = (await embedded.boundingBox())!
        expect(box.width).toBeGreaterThan(700)
        expect(box.height).toBeGreaterThan(400)
    })

    test('фильтр во вкладке работает и не трогает плавающую панель', async ({ page }) => {
        await open(page)
        await page.click('#bump')
        const tab = await openTab(page)
        const embedded = tab.locator('[data-vue-why-render="panel-embedded"] .vwr')
        await embedded.locator('.vwr__search').fill('Count')
        await expect(embedded.locator('.vwr__row')).toHaveCount(1)
        await expect(panel(page).locator('.vwr__search')).toHaveValue('')
    })

    test('без сканера на странице объясняет, в чём дело', async ({ page }) => {
        await page.goto('/__vue-why-render/devtools')
        await expect(page.locator('#note')).toBeVisible({ timeout: 6000 })
        await expect(page.locator('#note')).toContainText('vue-why-render is not running on this page')
    })
})
