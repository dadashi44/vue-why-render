---
title: API
description: Functions, the scan handle and the global handle exported by vue-why-render.
---

Everything below is imported from `vue-why-render`. The test helpers live in a separate
entry point, see [Test API](/docs/reference/test-api/). Options are listed in
[Options](/docs/reference/options/).

## Starting the scanner

### `scan(app, options?)`

```ts
function scan(app: App, options?: VueWhyRenderOptions): ScanHandle | null
```

Attaches the scanner to an app by hand, without `app.use`. Returns `null` when the
scanner is switched off with `enabled: false`. The default export, `VueWhyRender`, is a
plugin that calls `scan(app, options)` from `install`.

```ts
import { scan } from 'vue-why-render'

const handle = scan(app, { panel: false })
```

### `ScanHandle`

| Member | What it does |
| --- | --- |
| `stop()` | Stop collecting and remove the panel and the overlay. |
| `pause()` / `resume()` | Pause and resume recording. |
| `reset()` | Clear everything recorded so far. |
| `getStats()` | `ComponentRecord[]` — statistics for the live components. |
| `getEvents()` | `RenderEvent[]` — the ring buffer of events. |
| `getReport()` | `Report` — a snapshot of the whole session as one serialisable object. |
| `saveReport(filename?)` | Take a report and save it as a file. |
| `printReport(options?)` | Take a report and print it as a table to the console. |
| `getViolations()` | `BudgetViolation[]` — budget violations for the session. |

`handle.scanner` is the underlying `Scanner`.

### Shortcuts for the running scanner

Handy from the browser console. They act on the scanner started last:

```ts
getScanHandle(): ScanHandle | null
getStats(): ComponentRecord[]            // [] when the scanner is not running
getEvents(): RenderEvent[]               // [] when the scanner is not running
getReport(): Report | null
reset(): void
saveReport(filename?: string): void
printReport(report?: Report | null, options?: PrintOptions): void
```

`printReport()` without arguments prints the live session; with a `Report` it prints that
report — for example one parsed with `parseReport()`. When the scanner is not running and
no report is given it only logs a warning.

### `onRender`

The `onRender` option is called with every `RenderEvent`:

```ts
app.use(VueWhyRender, {
    onRender(event) {
        console.log(event.name, event.reasons)
    },
})
```

## Reports

See [Reports](/docs/guides/reports/) for the walkthrough.

```ts
function parseReport(input: string | unknown): Report
function serializeReport(report: Report): string
function downloadReport(report: Report, filename?: string): void
function diffReports(before: Report, after: Report): ReportDiff
function formatDiff(diff: ReportDiff, limit?: number): string[]      // limit defaults to 20
function formatReportMarkdown(report: Report, options?: MarkdownOptions): string
function reportRows(report: Report, options?: PrintOptions): PrintRow[]
```

`PrintOptions` is `{ limit?: number, locale?: Locale }`. `diffReports` runs in
WebAssembly when it is available, see [WASM engine](/docs/concepts/wasm/).

## WASM

```ts
function loadWasm(): Promise<boolean>   // explicit preload (scan() does this automatically)
function isWasmReady(): boolean
function wasmVersion(): string | null   // e.g. "0.1.0"
```

If WASM fails to load, a single `console.warn` is emitted and every call silently
uses the JS fallback.

## `window.__VUE_WHY_RENDER__`

While the scanner runs, a handle is placed on `window` — for tests that cannot import
the package, such as Playwright:

| Member | What it does |
| --- | --- |
| `version` | Package version. |
| `getReport()` | The session report. |
| `getViolations()` | Budget violations, see [Budgets](/docs/guides/budgets/). |
| `printReport(options?)` | Print the session to the console. |
| `pause()` / `resume()` / `reset()` | Control recording. |
| `mountPanel(target)` | Mount the panel into a container you own; returns an unmount function. This is how the Nuxt DevTools tab is drawn. |
