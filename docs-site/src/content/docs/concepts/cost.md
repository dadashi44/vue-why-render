---
title: Cost
description: Why vue-why-render is a development-only tool and how to keep it out of production.
---

This is a dev-only tool for three reasons, and none of them is an abundance of caution:

1. `renderTriggered` only fires in a development build of Vue — in production the hook is never called at all.
2. The callback runs on every reactivity trigger. If you are profiling timings specifically, set `trackReasons: false`.
3. The global mixin adds hooks to every component in the application.

`renderTracked` — which fires on every **read** of a reactive value — is deliberately not
used: that is thousands of calls per second, and nothing left to profile.

**Switching the scanner off in production is the caller's job.** The package makes no
attempt to guess the build mode: `process` is not available in a browser bundle, and a
bare reference to `process.env.NODE_ENV` breaks the consuming application's production
build — `@rollup/plugin-commonjs` mistakes such an ESM file for mixed CommonJS and
rewrites it into syntactically broken code. So the scanner is simply on by default.

The right way is a static bundler flag, which strips both the call and the import itself:

```ts
// Vite
if (import.meta.env.DEV) {
    const { default: VueWhyRender } = await import('vue-why-render')
    app.use(VueWhyRender)
}
```

**On Nuxt, use the module** — `modules: ['vue-why-render/nuxt']`, see [Nuxt](/docs/start/nuxt/). It does this for you:
in a production build it registers no plugin at all, so there is nothing left to strip.
That is the whole reason it exists.
