---
title: 手动调用，不使用插件
description: 通过 scan() 自行启动和停止 vue-why-render，无需 app.use。
---

```ts
import { scan } from 'vue-why-render'

const handle = scan(app, { panel: false })

handle?.pause()
handle?.getStats()
handle?.stop()
```
