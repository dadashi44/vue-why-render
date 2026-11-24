---
title: Nuxt
description: 使用 vue-why-render 的 Nuxt 模块，或手动注册插件。
---

直接引入模块。它会在开发模式下注册一个仅客户端插件，而在生产构建中不留下任何痕迹 ——
连 import 都没有：

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

插件的所有[配置项](/docs/zh-cn/reference/options/)都可以写在 `whyRender` 键下，只有 `onRender` 除外：回调函数无法从
`nuxt.config` 搬进生成的插件。如果需要回调，请按下面的方式手动注册。出于同样的原因，
`include` 和 `exclude` 中的函数会被丢弃并在终端给出提示；正则和字符串则完整保留。

模块还会在 Nuxt DevTools 中添加一个 **Why render** 标签页 —— 见
[Vue DevTools 与 Nuxt DevTools](/docs/zh-cn/guides/devtools/)。

## 手动注册，不使用模块

```ts
// plugins/why-render.client.ts —— .client 后缀使其不进入 SSR
import VueWhyRender from 'vue-why-render'

export default defineNuxtPlugin((nuxtApp) => {
    nuxtApp.vueApp.use(VueWhyRender)
})
```

请注意：除非自己手动剔除，这种写法会进入生产构建 —— 见[开销](/docs/zh-cn/concepts/cost/)。
模块的存在正是为了让人无法忘记这件事。
