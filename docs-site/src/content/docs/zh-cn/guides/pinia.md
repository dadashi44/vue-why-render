---
title: Pinia
description: 无需配置即可看到是哪个 store、哪个字段、哪个 action 触发了渲染。
---

当原因来自 store 时，面板会指出是哪个 store、哪个字段，以及当时正在执行的 action：

```
CartSummary ×3 · 0.2ms
├─ store cart.items: Array(1) → Array(0) · action clear()
└─ store cart.total: 2100 → 0 · action clear()
```

无需任何配置：无论 `app.use(pinia)` 和本插件的调用顺序如何，本包都会自行在应用上找到 Pinia，
并且同时支持 Pinia 2、3、4，而不依赖其中任何一个。

为什么这需要额外的工作：Vue 报告的是发生变化的那个对象，而对 store 来说它从来不是 store 本身。
`cart.count++` 触发在状态对象上，`cart.items.push()` 触发在数组上，setup store 的 `ref` 触发在 ref 自身上，
它们都不知道自己属于哪个 store。因此本包维护了一个索引：记录每个 store 状态中每个对象所在的位置。
查找只是一次 `WeakMap` 读取；当有新对象放入 store（`push({ … })`、`cart.current = { … }`）时，
它的子树会立即加入索引。

- **action** 来自 `$onAction`。异步 action 在结束之前都算作正在执行，所以 `await` 之后的修改仍归属于它；
  嵌套调用时以最内层的 action 为准。组件中的直接赋值或 `$patch` 没有 action，面板也不会凭空编造。
- **向 store 中的数组添加或删除元素**时，原因记为数组本身——`store cart.items (add)`，而不是 `cart.items[7]`：
  每次 `push` 的下标都不同，差异对比、频率表和预算每次都会看到一个“新原因”。
- **限制。** 索引最多深入四层，每个 store 最多 500 个节点。store 中超大数组的尾部会显示为普通的数组变化，不带 store 名称。

`pinia: false` 可以全部关闭。
