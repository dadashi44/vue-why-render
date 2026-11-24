---
title: Vue DevTools and Nuxt DevTools
description: The Why render inspector and timeline layer in Vue DevTools, and the Why render tab in Nuxt DevTools.
---

## Vue DevTools

If the extension is installed, the package registers itself there as well: a
**Why render** inspector next to the component tree, and a **Why render** layer on
the timeline with one event per render.

The inspector lists components by render count; selecting one shows the reason for
its last render, the prop diff and the hints. Nothing to configure — it appears when
DevTools is open, and costs nothing when it is not.

```ts
app.use(VueWhyRender, { devtools: false })   // if you only want the own panel
```

**If the inspector does not show up**, the usual reason is not this package.
Vue DevTools has a **High Performance Mode**, and while it is on, no third-party
inspector is created at all — not this one, not Pinia's, not the router's. The gate
lives in `@vue/devtools-kit`:

```js
if (devtoolsState.highPerfModeEnabled && !options?.inspectingComponent) return
```

Turn it off in the Vue tab settings and reload the page. The second condition is
simply that the Vue tab has to be open: plugins are instantiated when the DevTools
client connects, and until then the registration sits in a queue.

The own panel is not replaced by this and is not going anywhere. The extension is not
installed everywhere — a locked-down environment, someone else's browser during a demo,
a webview. The panel works where DevTools is absent; DevTools is more convenient where
it is present.

**No new dependency.** The usual way in is `@vue/devtools-api`, which in version 8
pulls `@vue/devtools-kit` behind it. The whole integration point is one event on
`window.__VUE_DEVTOOLS_GLOBAL_HOOK__`, so it is inlined — about twenty lines, and the
package still has zero runtime dependencies.

## Nuxt DevTools

The [Nuxt module](/docs/start/nuxt/) adds a **Why render** tab to Nuxt DevTools — the same panel, live, filling the
whole tab, next to the other tools. Checked with DevTools 3.4; DevTools 4.0 (in beta) still collects module tabs through
the same hook. It adds no dependency: the tab is a page the dev server serves, and the panel inside it is
drawn by your app's own Vue through `window.__VUE_WHY_RENDER__`.

If the floating panel is in the way, keep only the tab:

```ts
whyRender: { panel: false },        // the DevTools tab still works
whyRender: { devtoolsTab: false },  // or the other way round
```

`devtoolsTab` exists only in `nuxt.config`: the tab is registered by the build, not by
the app.
