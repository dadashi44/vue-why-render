---
title: API
description: vue-why-render 导出的函数、扫描句柄与全局句柄。
---

下面的内容都从 `vue-why-render` 导入。测试辅助函数在单独的入口中，见
[测试 API](/docs/zh-cn/reference/test-api/)。配置项列在[配置项](/docs/zh-cn/reference/options/)中。

## 启动扫描器

### `scan(app, options?)`

```ts
function scan(app: App, options?: VueWhyRenderOptions): ScanHandle | null
```

手动把扫描器挂到应用上，不经过 `app.use`。若用 `enabled: false` 关闭了扫描器，则返回
`null`。默认导出 `VueWhyRender` 是一个插件，它在 `install` 中调用 `scan(app, options)`。

```ts
import { scan } from 'vue-why-render'

const handle = scan(app, { panel: false })
```

### `ScanHandle`

| 成员 | 作用 |
| --- | --- |
| `stop()` | 停止收集数据，并移除面板与高亮层。 |
| `pause()` / `resume()` | 暂停和继续记录。 |
| `reset()` | 清除到目前为止记录的全部内容。 |
| `getStats()` | `ComponentRecord[]` —— 存活组件的统计。 |
| `getEvents()` | `RenderEvent[]` —— 事件环形缓冲区。 |
| `getReport()` | `Report` —— 整个会话的快照，一个可序列化的对象。 |
| `saveReport(filename?)` | 生成报告并保存为文件。 |
| `printReport(options?)` | 生成报告并以表格形式打印到控制台。 |
| `getViolations()` | `BudgetViolation[]` —— 本次会话中超出预算的情况。 |

`handle.scanner` 是底层的 `Scanner`。

### 针对运行中扫描器的快捷函数

适合在浏览器控制台中调用。它们作用于最后一个启动的扫描器：

```ts
getScanHandle(): ScanHandle | null
getStats(): ComponentRecord[]            // 扫描器未运行时为 []
getEvents(): RenderEvent[]               // 扫描器未运行时为 []
getReport(): Report | null
reset(): void
saveReport(filename?: string): void
printReport(report?: Report | null, options?: PrintOptions): void
```

不带参数的 `printReport()` 打印当前会话；传入 `Report` 则打印该报告，例如用 `parseReport()`
解析出来的报告。扫描器未运行且没有传入报告时，它只会输出一条警告。

### `onRender`

`onRender` 配置项会在每个 `RenderEvent` 上被调用：

```ts
app.use(VueWhyRender, {
    onRender(event) {
        console.log(event.name, event.reasons)
    },
})
```

## 报告

详细说明见[报告](/docs/zh-cn/guides/reports/)。

```ts
function parseReport(input: string | unknown): Report
function serializeReport(report: Report): string
function downloadReport(report: Report, filename?: string): void
function diffReports(before: Report, after: Report): ReportDiff
function formatDiff(diff: ReportDiff, limit?: number): string[]      // limit 默认为 20
function formatReportMarkdown(report: Report, options?: MarkdownOptions): string
function reportRows(report: Report, options?: PrintOptions): PrintRow[]
```

`PrintOptions` 为 `{ limit?: number, locale?: Locale }`。`diffReports` 在 WebAssembly 可用时
由其执行，见 [WASM 引擎](/docs/zh-cn/concepts/wasm/)。

## WASM

```ts
function loadWasm(): Promise<boolean>   // 显式预加载（scan() 会自动完成）
function isWasmReady(): boolean
function wasmVersion(): string | null   // 例如 "0.1.0"
```

如果 WASM 加载失败，只会输出一条 `console.warn`，之后每次调用都会静默地使用 JS 回退实现。

## `window.__VUE_WHY_RENDER__`

扫描器运行期间，`window` 上会放一个句柄 —— 供无法导入本包的测试使用，例如 Playwright：

| 成员 | 作用 |
| --- | --- |
| `version` | 包版本。 |
| `getReport()` | 会话报告。 |
| `getViolations()` | 超出预算的情况，见[预算](/docs/zh-cn/guides/budgets/)。 |
| `printReport(options?)` | 把会话打印到控制台。 |
| `pause()` / `resume()` / `reset()` | 控制记录。 |
| `mountPanel(target)` | 把面板挂载到你自己的容器中；返回卸载函数。Nuxt DevTools 的标签页就是这样绘制的。 |
