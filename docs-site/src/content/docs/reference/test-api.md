---
title: Test API
description: Signatures of renderTracking, expectRenders and the other helpers from vue-why-render/test.
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

For a walkthrough with an example, see [Render assertions in tests](/docs/guides/tests/).

## `renderTracking(options?)`

```ts
function renderTracking(options?: VueWhyRenderOptions): Plugin
```

A Vue plugin for `mount(App, { global: { plugins: [renderTracking()] } })`. It installs
the scanner on the app and starts collecting events. Installing it stops any tracker that
was active before.

The plugin sets a few options for tests: `panel: false`, `overlay: false`,
`includeMounts: false`, `trackReasons: true`, `trackProps: true`, `minDuration: 0`,
`sampleRate: 1`, `pauseHotkey: false`. Options you pass are applied on top of those,
and `onRender` is still called for every event.

## `expectRenders(target)`

```ts
type RenderTarget = string | RegExp | { name?: string, __name?: string }

function expectRenders(target: RenderTarget): {
    toBe(count: number, action: () => unknown): Promise<RenderEvent[]>
    toBeAtMost(count: number, action: () => unknown): Promise<RenderEvent[]>
}
```

`target` is a component, its name, or a regular expression. A component is matched by
`name`, falling back to `__name`.

| Method | What it does |
| --- | --- |
| `toBe(n, action)` | Exactly `n` re-renders of the target during the action. |
| `toBeAtMost(n, action)` | No more than `n`, for cases where an exact number is brittle. |

Both run the action, wait for `nextTick`, and resolve with the matching `RenderEvent[]`.
When the assertion fails they throw an error that names the component, the file when
known, and the reasons:

```
[vue-why-render] expected ProductCard to re-render 0 time(s), but it re-rendered 1 time(s)
reasons:
  - prop badge: { text } -> { text } (new reference, same value)
```

## `recordRenders(action)`

```ts
function recordRenders(action: () => unknown): Promise<RenderEvent[]>
```

Runs the action, waits for `nextTick`, and returns the raw events recorded meanwhile —
build your own assertions on top. Throws if no tracking is active.

## `stopRenderTracking()`

```ts
function stopRenderTracking(): void
```

Removes the active tracker. Call it in `afterEach`, or the tracker outlives the test.

## `getRenderTracker()`

```ts
interface RenderTracker {
    handle: ScanHandle
    events: RenderEvent[]   // every event since installation
    stop: () => void
}

function getRenderTracker(): RenderTracker | null
```

The active tracker, or `null`. Useful when you need the whole event list or the
[scan handle](/docs/reference/api/) of the test app.
