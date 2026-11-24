---
title: Render assertions in tests
description: Fail a test when a component re-renders more than it should, and see why.
---

The scanner counts renders, so it can be pointed at regressions: a wasted render
you fixed once stops coming back.

```ts
import { mount } from '@vue/test-utils'
import { expectRenders, renderTracking, stopRenderTracking } from 'vue-why-render/test'

afterEach(() => stopRenderTracking())

it('the card does not re-render while filtering', async () => {
    const wrapper = mount(App, { global: { plugins: [renderTracking()] } })

    await expectRenders(ProductCard).toBe(0, async () => {
        await wrapper.find('input').setValue('mouse')
    })
})
```

When the assertion fails it does not just report a number — it says why:

```
[vue-why-render] expected ProductCard to re-render 0 time(s), but it re-rendered 1 time(s)
reasons:
  - prop badge: { text } -> { text } (new reference, same value)
```

| Helper | What it does |
| --- | --- |
| `renderTracking(options?)` | A Vue plugin for `global.plugins`. `mount()` creates the app itself, so a plugin is the only way in. |
| `expectRenders(target).toBe(n, action)` | Exactly `n` re-renders during the action. |
| `expectRenders(target).toBeAtMost(n, action)` | No more than `n`, for cases where an exact number is brittle. |
| `recordRenders(action)` | The raw `RenderEvent[]` for the window — build your own assertions. |
| `stopRenderTracking()` | Call it in `afterEach`, or the tracker outlives the test. |

`target` is a component, its name, or a regular expression.

Two things are decided for you and cannot be surprising: the panel and the overlay
are off, so they never touch the DOM your test queries; and mounts are not counted,
because a first render is never the wasted one.

The helper waits for `nextTick` after the action — Vue updates asynchronously, and
without it every assertion would see zero renders and pass for the wrong reason.
