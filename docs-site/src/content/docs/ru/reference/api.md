---
title: API
description: Функции, хендл сканера и глобальный хендл, которые экспортирует vue-why-render.
---

Всё ниже импортируется из `vue-why-render`. Хелперы для тестов живут в отдельной точке входа,
см. [API для тестов](/docs/ru/reference/test-api/). Опции перечислены в
[Опциях](/docs/ru/reference/options/).

## Запуск сканера

### `scan(app, options?)`

```ts
function scan(app: App, options?: VueWhyRenderOptions): ScanHandle | null
```

Навешивает сканер на приложение вручную, без `app.use`. Возвращает `null`, если сканер
выключен опцией `enabled: false`. Экспорт по умолчанию, `VueWhyRender`, — плагин, который
в `install` вызывает `scan(app, options)`.

```ts
import { scan } from 'vue-why-render'

const handle = scan(app, { panel: false })
```

### `ScanHandle`

| Член | Что делает |
| --- | --- |
| `stop()` | Остановить сбор данных и убрать панель с оверлеем. |
| `pause()` / `resume()` | Поставить запись на паузу и продолжить. |
| `reset()` | Очистить всё записанное. |
| `getStats()` | `ComponentRecord[]` — статистика по живым компонентам. |
| `getEvents()` | `RenderEvent[]` — кольцевой буфер событий. |
| `getReport()` | `Report` — снимок всей сессии одним сериализуемым объектом. |
| `saveReport(filename?)` | Снять отчёт и сохранить файлом. |
| `printReport(options?)` | Снять отчёт и напечатать таблицей в консоль. |
| `getViolations()` | `BudgetViolation[]` — нарушения бюджетов за сессию. |

`handle.scanner` — сам `Scanner` под капотом.

### Короткие вызовы для работающего сканера

Удобно дёргать из консоли браузера. Работают с сканером, запущенным последним:

```ts
getScanHandle(): ScanHandle | null
getStats(): ComponentRecord[]            // [], если сканер не запущен
getEvents(): RenderEvent[]               // [], если сканер не запущен
getReport(): Report | null
reset(): void
saveReport(filename?: string): void
printReport(report?: Report | null, options?: PrintOptions): void
```

`printReport()` без аргументов печатает живую сессию, с `Report` — любой отчёт, например
разобранный `parseReport()`. Если сканер не запущен и отчёт не передан, он только пишет
предупреждение.

### `onRender`

Опция `onRender` вызывается с каждым `RenderEvent`:

```ts
app.use(VueWhyRender, {
    onRender(event) {
        console.log(event.name, event.reasons)
    },
})
```

## Отчёты

Пошаговый разбор — в разделе [Отчёты](/docs/ru/guides/reports/).

```ts
function parseReport(input: string | unknown): Report
function serializeReport(report: Report): string
function downloadReport(report: Report, filename?: string): void
function diffReports(before: Report, after: Report): ReportDiff
function formatDiff(diff: ReportDiff, limit?: number): string[]      // limit по умолчанию 20
function formatReportMarkdown(report: Report, options?: MarkdownOptions): string
function reportRows(report: Report, options?: PrintOptions): PrintRow[]
```

`PrintOptions` — это `{ limit?: number, locale?: Locale }`. `diffReports` выполняется
в WebAssembly, когда он доступен, см. [WASM-движок](/docs/ru/concepts/wasm/).

## WASM

```ts
function loadWasm(): Promise<boolean>   // явная предзагрузка (scan() делает это сам)
function isWasmReady(): boolean
function wasmVersion(): string | null   // например "0.1.0"
```

Если WASM не загрузился, выводится один `console.warn`, а каждый вызов молча идёт
через JS-запасной вариант.

## `window.__VUE_WHY_RENDER__`

Пока сканер работает, на `window` лежит хендл — для тестов, которые не могут импортировать
пакет, например Playwright:

| Член | Что делает |
| --- | --- |
| `version` | Версия пакета. |
| `getReport()` | Отчёт по сессии. |
| `getViolations()` | Нарушения бюджетов, см. [Бюджеты](/docs/ru/guides/budgets/). |
| `printReport(options?)` | Напечатать сессию в консоль. |
| `pause()` / `resume()` / `reset()` | Управление записью. |
| `mountPanel(target)` | Смонтировать панель в ваш контейнер; возвращает функцию размонтирования. Так рисуется вкладка Nuxt DevTools. |
