---
title: Nuxt
description: Модуль vue-why-render для Nuxt и ручная регистрация плагина.
---

Подключите модуль. Он сам регистрирует клиентский плагин в деве, а в прод-сборке
не оставляет ничего — даже импорта:

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

Под ключом `whyRender` работают все опции плагина, кроме `onRender`:
колбэк нельзя перенести из `nuxt.config` в сгенерированный плагин. Если он нужен —
подключайтесь вручную (ниже). Функции в `include` и `exclude` отбрасываются по той же
причине, и модуль говорит об этом в терминале; регулярки и строки доезжают целиком.

Ещё модуль добавляет вкладку **Why render** в Nuxt DevTools — см.
[Vue DevTools и Nuxt DevTools](/docs/ru/guides/devtools/).

## Вручную, без модуля

```ts
// plugins/why-render.client.ts — суффикс .client не пускает файл в SSR
import VueWhyRender from 'vue-why-render'

export default defineNuxtPlugin((nuxtApp) => {
    nuxtApp.vueApp.use(VueWhyRender)
})
```

Учтите, что этот вариант уедет в прод-сборку, если не вырезать его самому —
см. «Стоимость». Модуль существует ровно для того, чтобы об этом нельзя было забыть.
