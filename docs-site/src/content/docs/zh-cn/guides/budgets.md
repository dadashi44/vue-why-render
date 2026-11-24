---
title: 预算
description: 限制组件重新渲染的频率，不满足时让 CI 失败。
---

规定组件多久可以重新渲染一次，或一次更新最多耗时多少，一旦不满足，扫描器会立即告诉你：

```ts
app.use(VueWhyRender, {
    budgets: [
        { maxRenders: 5, per: 1000 },                     // 任意组件，每秒 5 次渲染
        { include: [/^ProductCard$/], maxDuration: 16 },  // 每次更新不超过一帧
    ],
})
```

```
[vue-why-render] budget exceeded: ProductCard rendered 12 times in 1000ms (limit 5) — last reason: prop badge: { text } → { text } — new reference, same value
```

时间窗口按实例计算：要问的是“这个组件是否在疯狂渲染？”，而不是“列表里有多少行”。
每个组件、每种违规只在控制台提示一次，之后只累加次数和最差值。面板会把违规组件的渲染次数标红，
违规信息也会写入报告、Markdown 块和 `printReport()`。

## 让 CI 失败

Playwright 测试无法导入页面中的模块，所以扫描器会在 `window.__VUE_WHY_RENDER__` 上放一个小句柄：
`getReport()`、`getViolations()`、`printReport()`、`pause()`、`resume()`、`reset()`。
请在开发模式下运行应用，扫描器此时是开启的：

```ts
test('目录页不超出渲染预算', async ({ page }) => {
    await page.goto('/catalog')
    await page.getByRole('searchbox').fill('鼠标')

    const violations = await page.evaluate(() => window.__VUE_WHY_RENDER__?.getViolations() ?? [])
    expect(violations).toEqual([])
})
```

`stop()` 会移除这个句柄。组件测试请改用[测试中的渲染断言](/docs/zh-cn/guides/tests/)。
