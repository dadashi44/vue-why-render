---
title: API для тестов
description: Сигнатуры renderTracking, expectRenders и других хелперов из vue-why-render/test.
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

Пошаговый разбор с примером — в разделе [Проверки в тестах](/docs/ru/guides/tests/).

## `renderTracking(options?)`

```ts
function renderTracking(options?: VueWhyRenderOptions): Plugin
```

Vue-плагин для `mount(App, { global: { plugins: [renderTracking()] } })`. Он ставит сканер
на приложение и начинает собирать события. Установка останавливает трекер, который был
активен до этого.

Плагин задаёт несколько опций для тестов: `panel: false`, `overlay: false`,
`includeMounts: false`, `trackReasons: true`, `trackProps: true`, `minDuration: 0`,
`sampleRate: 1`, `pauseHotkey: false`. Переданные вами опции накладываются поверх них,
а `onRender` по-прежнему вызывается на каждое событие.

## `expectRenders(target)`

```ts
type RenderTarget = string | RegExp | { name?: string, __name?: string }

function expectRenders(target: RenderTarget): {
    toBe(count: number, action: () => unknown): Promise<RenderEvent[]>
    toBeAtMost(count: number, action: () => unknown): Promise<RenderEvent[]>
}
```

`target` — сам компонент, его имя или регулярка. Компонент сопоставляется по `name`,
а если его нет — по `__name`.

| Метод | Что делает |
| --- | --- |
| `toBe(n, action)` | Ровно `n` перерисовок цели за время действия. |
| `toBeAtMost(n, action)` | Не больше `n` — там, где точное число хрупко. |

Оба запускают действие, ждут `nextTick` и возвращают подходящие `RenderEvent[]`.
Когда проверка падает, они бросают ошибку с именем компонента, файлом (если он известен)
и причинами:

```
[vue-why-render] expected ProductCard to re-render 0 time(s), but it re-rendered 1 time(s)
reasons:
  - prop badge: { text } -> { text } (new reference, same value)
```

## `recordRenders(action)`

```ts
function recordRenders(action: () => unknown): Promise<RenderEvent[]>
```

Запускает действие, ждёт `nextTick` и возвращает сырые события, записанные за это время, —
стройте на них свои проверки. Бросает ошибку, если слежение не включено.

## `stopRenderTracking()`

```ts
function stopRenderTracking(): void
```

Снимает активный трекер. Зовите в `afterEach`, иначе трекер переживёт тест.

## `getRenderTracker()`

```ts
interface RenderTracker {
    handle: ScanHandle
    events: RenderEvent[]   // все события с момента установки
    stop: () => void
}

function getRenderTracker(): RenderTracker | null
```

Активный трекер или `null`. Пригодится, когда нужен весь список событий или
[хендл сканера](/docs/ru/reference/api/) тестового приложения.
