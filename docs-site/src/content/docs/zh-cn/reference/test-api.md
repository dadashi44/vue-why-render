---
title: 测试 API
description: vue-why-render/test 中 renderTracking、expectRenders 等辅助函数的签名。
---

```ts
import {
    renderTracking,
    expectRenders,
    recordRenders,
    stopRenderTracking,
    getRenderTracker,
} from 'vue-why-render/test'
```

带示例的说明见[在测试中断言渲染次数](/docs/zh-cn/guides/tests/)。

## `renderTracking(options?)`

```ts
function renderTracking(options?: VueWhyRenderOptions): Plugin
```

用于 `mount(App, { global: { plugins: [renderTracking()] } })` 的 Vue 插件。它把扫描器安装到
应用上并开始收集事件。安装时会先停掉之前处于活动状态的跟踪器。

插件为测试预设了几个配置项：`panel: false`、`overlay: false`、`includeMounts: false`、
`trackReasons: true`、`trackProps: true`、`minDuration: 0`、`sampleRate: 1`、
`pauseHotkey: false`。你传入的配置项会叠加在这些之上，`onRender` 仍会在每个事件上被调用。

## `expectRenders(target)`

```ts
type RenderTarget = string | RegExp | { name?: string, __name?: string }

function expectRenders(target: RenderTarget): {
    toBe(count: number, action: () => unknown): Promise<RenderEvent[]>
    toBeAtMost(count: number, action: () => unknown): Promise<RenderEvent[]>
}
```

`target` 可以是组件本身、组件名或正则表达式。组件按 `name` 匹配，没有 `name` 时按 `__name`。

| 方法 | 作用 |
| --- | --- |
| `toBe(n, action)` | 动作期间目标恰好重新渲染 `n` 次。 |
| `toBeAtMost(n, action)` | 不超过 `n` 次，适用于精确数字过于脆弱的场景。 |

两者都会执行动作、等待 `nextTick`，并返回匹配的 `RenderEvent[]`。断言失败时会抛出错误，
其中包含组件名、文件（已知时）以及原因：

```
[vue-why-render] expected ProductCard to re-render 0 time(s), but it re-rendered 1 time(s)
reasons:
  - prop badge: { text } -> { text } (new reference, same value)
```

## `recordRenders(action)`

```ts
function recordRenders(action: () => unknown): Promise<RenderEvent[]>
```

执行动作，等待 `nextTick`，并返回这段时间内记录的原始事件 —— 可在其上自行编写断言。
如果没有启用跟踪则抛出错误。

## `stopRenderTracking()`

```ts
function stopRenderTracking(): void
```

移除当前活动的跟踪器。请在 `afterEach` 中调用，否则跟踪器会比测试活得更久。

## `getRenderTracker()`

```ts
interface RenderTracker {
    handle: ScanHandle
    events: RenderEvent[]   // 自安装以来的全部事件
    stop: () => void
}

function getRenderTracker(): RenderTracker | null
```

返回当前活动的跟踪器，或 `null`。需要完整事件列表或测试应用的
[扫描句柄](/docs/zh-cn/reference/api/)时很有用。
