---
title: 开销
description: 为什么 vue-why-render 只用于开发环境，以及如何让它不进入生产构建。
---

这是一个仅用于开发环境的工具，原因有三，且都不是出于过度谨慎：

1. `renderTriggered` 只在 Vue 的开发构建中触发 —— 生产环境下该钩子根本不会被调用。
2. 回调会在每一次响应式触发时执行。如果你专门要profiling耗时，请设置 `trackReasons: false`。
3. 全局 mixin 会给应用中的每个组件都加上钩子。

`renderTracked` —— 它在响应式值每次被**读取**时触发 —— 是刻意不使用的：那是每秒数千次
调用，profiling 本身就失去了意义。

**在生产环境关掉扫描器是调用方的责任。** 本包不会试图猜测构建模式：浏览器产物中没有
`process`，而对 `process.env.NODE_ENV` 的裸引用会破坏使用方的生产构建 ——
`@rollup/plugin-commonjs` 会把这样的 ESM 文件误认为混合 CommonJS，并将其改写成语法损坏的
代码。因此扫描器默认就是开启的。

正确的做法是使用打包器的静态标志，它会同时消除调用与 import 本身：

```ts
// Vite
if (import.meta.env.DEV) {
    const { default: VueWhyRender } = await import('vue-why-render')
    app.use(VueWhyRender)
}
```

**在 Nuxt 中请使用模块** —— `modules: ['vue-why-render/nuxt']`，见 [Nuxt](/docs/zh-cn/start/nuxt/)。它替你完成了这件事：
生产构建中根本不会注册插件，也就没有什么需要剔除的。模块存在的意义正在于此。
