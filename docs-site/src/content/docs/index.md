---
title: Introduction
description: See which Vue components re-render and why exactly.
---

See which Vue components re-render — and **why exactly**.

Other tools flash a border around a component that just updated. That is enough to
notice a problem, but not to fix it — you are still left asking *what actually changed?*
`vue-why-render` answers that: it names the exact reactive dependency that triggered
the render.

```
ProductCard ×7 · 2.4ms · badge
└─ prop badge: { text } → { text } — new reference, same value
```

In React you have to guess this by diffing props. Vue hands you the reason itself,
through the `renderTriggered` hook — this package is built around it.

[Try the live sandbox](https://vue-why-render.js.org/) · [GitHub](https://github.com/dadashi44/vue-why-render)

## Features

- **The reason, not just the fact**: the name of the prop, ref, Pinia store field or array index, plus the old and new value.
- **A dedicated "new reference, same value" verdict** — by far the most common source of wasted renders.
- **Overlay**: a border around the re-rendered component, coloured from green to red by frequency.
- **Panel**: top by render count, top by time, a component tree with per-subtree totals, and an event feed.
- **Jump to your editor**: clicking a row opens the SFC in your IDE through the dev server.
- **Pinia**: which store, which field, and which action was running — `store cart.items (add) · action add()`. Nothing to configure, no dependency on Pinia.
- **Vue Router**: a navigation is named by what changed — `route params.id: "/p/1" → "/p/42"` — with a hint when a component re-renders on every navigation.
- **Pause, reset and filter** by component name or file path; `Alt+Shift+P` pauses from the keyboard. The panel can be dragged anywhere, follows the system light or dark theme, and copies a reason in one click.
- **Vue DevTools**: an inspector and a timeline layer in the extension, without adding a dependency.
- **Nuxt DevTools**: a **Why render** tab with the same live panel, from the Nuxt module, without a dependency.
- **Render assertions in tests**: `expectRenders(ProductCard).toBe(0, …)` — a wasted render you fixed once stops coming back.
- **Hints**: next to the reason, what to do about it — hoist the object, move the handler into a method, consider `v-memo`.
- **Reports**: save the whole session as JSON from the panel, and `diffReports(before, after)` to prove a fix actually worked. Open a saved report back in the panel, copy the session as Markdown for an issue, or `printReport()` to the console.
- **Render budgets**: `budgets: { maxRenders: 5 }` warns when a component thrashes, and `window.__VUE_WHY_RENDER__` lets a Playwright test fail CI on it.
- **API**: `getStats()`, `getEvents()`, `getReport()` and an `onRender` callback, so you can build your own tooling.
- **Powered by Rust/WASM**: hot-path algorithms run in WebAssembly — no GC pauses, predictable latency, so the tool itself does not distort the measurements it reports. Falls back to JS transparently when WASM is unavailable.
