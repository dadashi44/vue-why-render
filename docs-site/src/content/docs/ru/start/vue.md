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

Это инструмент только для разработки: оберните `app.use(...)` в `if (import.meta.env.DEV)`,
как описано на странице [Стоимость](/docs/ru/concepts/cost/).

Используете Nuxt? См. [Nuxt](/docs/ru/start/nuxt/). Хотите сами запускать и останавливать
отслеживание, без плагина? См. [Вручную, без плагина](/docs/ru/start/manual/).
