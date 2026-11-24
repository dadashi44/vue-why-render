---
title: Вручную, без плагина
description: Запуск и остановка vue-why-render самостоятельно через scan(), без app.use.
---

```ts
import { scan } from 'vue-why-render'

const handle = scan(app, { panel: false })

handle?.pause()
handle?.getStats()
handle?.stop()
```
