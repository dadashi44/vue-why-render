---
title: Проверки в тестах
description: Уронить тест, если компонент перерисовывается чаще, чем должен, и узнать почему.
---

Сканер умеет считать рендеры — значит, его можно повернуть в сторону регрессий:
лишний рендер, починенный однажды, перестаёт возвращаться.

```ts
import { mount } from '@vue/test-utils'
import { expectRenders, renderTracking, stopRenderTracking } from 'vue-why-render/test'

afterEach(() => stopRenderTracking())

it('карточка не перерисовывается при фильтрации', async () => {
    const wrapper = mount(App, { global: { plugins: [renderTracking()] } })

    await expectRenders(ProductCard).toBe(0, async () => {
        await wrapper.find('input').setValue('мышь')
    })
})
```

Когда проверка падает, она сообщает не число, а причину:

```
[vue-why-render] expected ProductCard to re-render 0 time(s), but it re-rendered 1 time(s)
reasons:
  - prop badge: { text } -> { text } (new reference, same value)
```

| Хелпер | Что делает |
| --- | --- |
| `renderTracking(options?)` | Vue-плагин для `global.plugins`. Именно плагин: `mount()` создаёт приложение сам и наружу его не отдаёт. |
| `expectRenders(target).toBe(n, action)` | Ровно `n` перерисовок за время действия. |
| `expectRenders(target).toBeAtMost(n, action)` | Не больше `n` — там, где точное число хрупко. |
| `recordRenders(action)` | Сырые `RenderEvent[]` за окно: стройте свои проверки. |
| `stopRenderTracking()` | Зовите в `afterEach`, иначе трекер переживёт тест. |

`target` — сам компонент, его имя или регулярка.

Два решения приняты за вас и неожиданностью быть не могут: панель и оверлей
выключены, поэтому они не трогают разметку, по которой тест ищет элементы;
монтирования не считаются, потому что первый рендер лишним не бывает.

После действия хелпер ждёт `nextTick`: обновления во Vue асинхронные, и без
этого любая проверка видела бы ноль рендеров и проходила бы по неверной причине.
