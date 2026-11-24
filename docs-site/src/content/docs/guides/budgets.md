---
title: Budgets
description: Limit how often a component re-renders and fail CI when it does not hold.
---

Say how often a component may re-render, or how long an update may take, and the
scanner tells you the moment it does not hold:

```ts
app.use(VueWhyRender, {
    budgets: [
        { maxRenders: 5, per: 1000 },                     // any component, 5 renders a second
        { include: [/^ProductCard$/], maxDuration: 16 },  // one frame per update
    ],
})
```

```
[vue-why-render] budget exceeded: ProductCard rendered 12 times in 1000ms (limit 5) — last reason: prop badge: { text } → { text } — new reference, same value
```

The window is per instance: the question is "is this component thrashing?", not "how
many rows does the list have". The console hears about each component and kind of
violation once; after that only the count and the worst value grow. The panel paints
the render count of an offender red, and violations go into the report, the Markdown
block and `printReport()`.

## Failing CI

A Playwright test cannot import the page's modules, so the scanner puts a small handle
on `window.__VUE_WHY_RENDER__` — `getReport()`, `getViolations()`, `printReport()`,
`pause()`, `resume()`, `reset()`. Run the app in dev mode, where the scanner is on:

```ts
test('the catalog stays within its render budget', async ({ page }) => {
    await page.goto('/catalog')
    await page.getByRole('searchbox').fill('mouse')

    const violations = await page.evaluate(() => window.__VUE_WHY_RENDER__?.getViolations() ?? [])
    expect(violations).toEqual([])
})
```

The handle is removed by `stop()`. For component tests, use
[render assertions](/docs/guides/tests/) instead.
