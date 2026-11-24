---
title: Бюджеты
description: Ограничить частоту перерисовок компонента и ронять CI, когда ограничение не выполняется.
---

Скажи, как часто компоненту можно перерисовываться или сколько может длиться
обновление, — и сканер сообщит, как только это перестанет выполняться:

```ts
app.use(VueWhyRender, {
    budgets: [
        { maxRenders: 5, per: 1000 },                     // любой компонент, 5 рендеров в секунду
        { include: [/^ProductCard$/], maxDuration: 16 },  // один кадр на обновление
    ],
})
```

```
[vue-why-render] budget exceeded: ProductCard rendered 12 times in 1000ms (limit 5) — last reason: prop badge: { text } → { text } — new reference, same value
```

Окно считается по инстансу: вопрос «этот компонент молотит?», а не «сколько строк
в списке». В консоль — один раз на компонент и вид нарушения, дальше растут только
счётчик и худшее значение. Панель красит счётчик рендеров нарушителя красным, а
нарушения попадают в отчёт, в Markdown-блок и в `printReport()`.

## Чтобы CI падал

Тест в Playwright не может импортировать модули страницы, поэтому сканер кладёт
небольшой handle в `window.__VUE_WHY_RENDER__` — `getReport()`, `getViolations()`,
`printReport()`, `pause()`, `resume()`, `reset()`. Запускай приложение в дев-режиме,
где сканер включён:

```ts
test('каталог укладывается в бюджет рендеров', async ({ page }) => {
    await page.goto('/catalog')
    await page.getByRole('searchbox').fill('мышь')

    const violations = await page.evaluate(() => window.__VUE_WHY_RENDER__?.getViolations() ?? [])
    expect(violations).toEqual([])
})
```

`stop()` снимает handle. Для тестов компонентов удобнее
[проверки в тестах](/docs/ru/guides/tests/).
