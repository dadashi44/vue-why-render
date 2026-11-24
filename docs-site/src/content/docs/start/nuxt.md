---
title: Nuxt
description: Use the vue-why-render Nuxt module, or register the plugin by hand.
---

Add the module. It registers a client-only plugin in development and leaves
nothing behind in a production build — not even the import:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
    modules: ['vue-why-render/nuxt'],
    whyRender: {
        exclude: [/^RouterLink/, /^Transition/],
        includeMounts: true,
    },
})
```

Every plugin option works under the `whyRender` key, except
`onRender` — a callback cannot be carried from `nuxt.config` into the generated
plugin. If you need one, register the plugin by hand (below). Functions passed to
`include` or `exclude` are dropped for the same reason and reported in the terminal;
regular expressions and strings survive.

The module also adds a **Why render** tab to Nuxt DevTools — see
Vue DevTools and Nuxt DevTools.

## By hand, without the module

```ts
// plugins/why-render.client.ts — the .client suffix keeps it out of SSR
import VueWhyRender from 'vue-why-render'

export default defineNuxtPlugin((nuxtApp) => {
    nuxtApp.vueApp.use(VueWhyRender)
})
```

Note that this variant ships in the production bundle unless you strip it yourself —
see Cost. The module exists precisely to make that impossible to forget.
