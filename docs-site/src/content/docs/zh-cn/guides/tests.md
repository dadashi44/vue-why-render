---
title: 在测试中断言渲染次数
description: 当组件的重新渲染超出预期时让测试失败，并看到原因。
---

扫描器会统计渲染次数，因此可以把它用来防止回归：修好一次的多余渲染，就不会再回来。

```ts
import { mount } from '@vue/test-utils'
import { expectRenders, renderTracking, stopRenderTracking } from 'vue-why-render/test'

afterEach(() => stopRenderTracking())

it('筛选时卡片不应重新渲染', async () => {
    const wrapper = mount(App, { global: { plugins: [renderTracking()] } })

    await expectRenders(ProductCard).toBe(0, async () => {
        await wrapper.find('input').setValue('mouse')
    })
})
```

断言失败时，它给出的不只是一个数字，而是原因：

```
[vue-why-render] expected ProductCard to re-render 0 time(s), but it re-rendered 1 time(s)
reasons:
  - prop badge: { text } -> { text } (new reference, same value)
```

| 辅助函数 | 作用 |
| --- | --- |
| `renderTracking(options?)` | 用于 `global.plugins` 的 Vue 插件。`mount()` 自行创建应用且不对外暴露，插件是唯一入口。 |
| `expectRenders(target).toBe(n, action)` | 动作期间恰好 `n` 次重新渲染。 |
| `expectRenders(target).toBeAtMost(n, action)` | 不超过 `n` 次，适用于精确数字过于脆弱的场景。 |
| `recordRenders(action)` | 返回该窗口内原始的 `RenderEvent[]`，可自行编写断言。 |
| `stopRenderTracking()` | 在 `afterEach` 中调用，否则追踪器会比测试活得更久。 |

`target` 可以是组件本身、组件名，或一个正则。

有两件事已经替你决定好，不会带来意外：面板与高亮层默认关闭，不会干扰测试查询的 DOM；
挂载不计入次数，因为首次渲染从来不是多余的那一次。

动作结束后辅助函数会等待 `nextTick` —— Vue 的更新是异步的，否则任何断言都会看到零次渲染，
并因为错误的原因而通过。
