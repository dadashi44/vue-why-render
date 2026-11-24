---
title: FAQ
description: Short answers to common questions about vue-why-render.
---

## How do I find and fix unnecessary re-renders in Vue 3?

Install `vue-why-render` as a dev dependency. It hooks into Vue's `renderTriggered`
and names the exact reactive dependency — a prop, ref, computed or Pinia store
field — that caused each re-render. The most common cause is passing a new object
reference that carries the same value (e.g. an inline `{ text }` in a template); the
package detects this and labels it "new reference, same value".

## Does it slow down my app?

The scanner runs `renderTriggered` callbacks, which Vue only fires in development
builds. In production, the hooks are never called — zero cost. The hot-path
algorithms run in WebAssembly (Rust) to minimise overhead during profiling, with a
JS fallback when WASM is unavailable. See [Cost](/docs/concepts/cost/) and
[WASM engine](/docs/concepts/wasm/).

## Does it work with Pinia?

Yes. When a Pinia store field triggers a render, the panel shows the store name,
the field, and which action was running: `store cart.items (add) · action add()`.
No configuration needed, no dependency on Pinia. See [Pinia](/docs/guides/pinia/).

## Does it work with Vue Router?

Yes. A navigation is named by what changed — `route params.id: "/p/1" → "/p/42"` —
instead of showing the full route object. If a component re-renders on *every*
navigation (because it reads the whole route), a hint warns about it.
See [Vue Router](/docs/guides/router/).

## Does it work with Nuxt?

Yes. Add `modules: ['vue-why-render/nuxt']` to your Nuxt config. A **Why render**
tab appears in Nuxt DevTools with the live panel. The module auto-disables in
production builds. See [Nuxt](/docs/start/nuxt/).

## Can I use it in CI / automated tests?

Yes. The package exports `expectRenders(Component).toBe(n, ...)` for Vitest, and
render budgets (`budgets: { maxRenders: 5 }`) that expose violations through
`window.__VUE_WHY_RENDER__` for Playwright. A wasted render you fixed once never
comes back. See [Render assertions in tests](/docs/guides/tests/) and
[Budgets](/docs/guides/budgets/).

## Why WebAssembly?

A profiling tool that allocates on the JS heap is subject to the same garbage
collection pauses as the code it measures. A GC stop-the-world pause during a
`buildTree` call inflates the reported render time — the tool distorts its own
measurements. WASM linear memory is invisible to the garbage collector: no GC
scanning, no pauses, deterministic memory management via Rust ownership. The result
is 2× lower worst-case latency and 2.4× less jitter compared to the JS path.
