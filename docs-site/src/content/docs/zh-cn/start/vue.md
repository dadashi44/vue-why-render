---
title: Vue
description: 用一次 app.use 调用把 vue-why-render 接入 Vue 3 应用。
---

在应用上注册插件：

```ts
import { createApp } from 'vue'
import VueWhyRender from 'vue-why-render'
import App from './App.vue'

const app = createApp(App)

app.use(VueWhyRender, {
    exclude: [/^RouterLink/, /^Transition/],
})

app.mount('#app')
```

使用 Nuxt？见 [Nuxt](/docs/zh-cn/start/nuxt/)。想自己启动和停止、不使用插件？见[手动调用，不使用插件](/docs/zh-cn/start/manual/)。
