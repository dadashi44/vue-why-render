---
title: Vue Router
description: Navigations are named by what changed in the route, with a hint for components that re-render on every navigation.
---

A navigation is named by what changed in the route, not reported as a ref that
swapped one route object for another:

```
ProductPage ×3 · 1.2ms
└─ route params.id: "/p/1" → "/p/42"
```

Params, query and hash are named by key — `params.id`, `query.tab`, `hash` — because
the parameter is the cause and the path is only its consequence. `path` shows up only
when nothing else changed, that is, when the page itself did. The values are the full
paths before and after, so you see both what changed and where from. The key does not
carry the values, so for the report diff and the budgets every navigation of
`params.id` is the same reason.

**The hint.** `useRoute()` and `$route` both read one ref, so a component that touches
any field of the route re-renders on **every** navigation — a header that only shows the
path re-renders when the query changes. The panel says so, and suggests the fix: if one
field is enough, `computed(() => route.params.id)` re-renders only when that field
changes. Which fields a component reads is not visible at runtime, so the wording is a
suggestion, not a verdict. See also [Hints](/docs/guides/hints/).

Works with Vue Router 4 and 5 without depending on either. `router: false` turns it off.
