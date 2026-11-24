---
title: Manually, without the plugin
description: Start and stop vue-why-render yourself with scan(), without app.use.
---

```ts
import { scan } from 'vue-why-render'

const handle = scan(app, { panel: false })

handle?.pause()
handle?.getStats()
handle?.stop()
```
