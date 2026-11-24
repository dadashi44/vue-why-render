---
title: Vue
description: Add vue-why-render to a Vue 3 app with a single app.use call.
---

Register the plugin on the app:

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

Using Nuxt? See [Nuxt](/docs/start/nuxt/). Want to start and stop it yourself, with no plugin?
See [Manually, without the plugin](/docs/start/manual/).
