---
title: Vue
description: Подключение vue-why-render к приложению на Vue 3 одним вызовом app.use.
---

Зарегистрируйте плагин в приложении:

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

Используете Nuxt? См. Nuxt. Хотите сами запускать и останавливать
отслеживание, без плагина? См. Вручную, без плагина.
