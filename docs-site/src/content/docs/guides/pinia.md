---
title: Pinia
description: Which store, which field and which action caused a render — with no configuration.
---

When the reason is a store, the panel says which store, which field, and which action
was running at the time:

```
CartSummary ×3 · 0.2ms
├─ store cart.items: Array(1) → Array(0) · action clear()
└─ store cart.total: 2100 → 0 · action clear()
```

Nothing to configure: the package finds Pinia on the app by itself, in whatever order
`app.use(pinia)` and the plugin were called, and works with Pinia 2, 3 and 4 without
depending on any of them.

Why this needs work at all: Vue reports the object a change happened on, and for a
store that object is never the store. `cart.count++` fires on the state object,
`cart.items.push()` on the array, a setup store's `ref` on the ref itself — and none of
them knows which store it belongs to. So the package keeps an index of where every
object of every store's state sits. A lookup is a single `WeakMap` read, and when a new
object is put into a store (`push({ … })`, `cart.current = { … }`) its subtree is added
to the index right away.

- **The action** comes from `$onAction`. An async action counts as running until it
  settles, so a change after an `await` is still attributed to it; in nested calls the
  innermost action wins. A direct assignment or `$patch` from a component has no action,
  and the panel does not invent one.
- **Adding to or removing from an array** in a store is reported as the array itself —
  `store cart.items (add)` — not as `cart.items[7]`: every `push` has its own index, and
  the diff, the frequency table and the budgets would see a new reason each time.
- **Limits.** The index goes four levels deep and up to 500 nodes per store. The tail of
  a huge array in a store shows up as an ordinary array change, without the store name.

`pinia: false` turns it all off.
