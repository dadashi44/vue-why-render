---
title: Compared to other tools
description: How vue-why-render differs from Vue DevTools and the Chrome Performance tab.
---

| Feature | vue-why-render | Vue DevTools | Chrome DevTools (Performance) |
|---------|:-:|:-:|:-:|
| **Shows which component re-rendered** | yes | yes (highlight) | no |
| **Names the exact prop / ref / store field** | yes | no | no |
| **"New reference, same value" verdict** | yes | no | no |
| **Pinia: store + field + action** | yes | partial (store only) | no |
| **Vue Router: names the changed param** | yes | no | no |
| **Render assertions in tests** | yes | no | no |
| **Render budgets (CI-friendly)** | yes | no | no |
| **Save / diff / compare reports** | yes | no | no |
| **Actionable hints (what to fix)** | yes | no | no |
| **Flame graph / CPU profile** | no | yes | yes |
| **Memory profiling** | no | no | yes |
| **Works in production** | no | yes | yes |

**Vue DevTools** shows that a component updated, but not which dependency caused it.
You still need to bisect props or add `watch` calls to find the trigger.
`vue-why-render` tells you the trigger directly — it is a debugging tool, not a
general profiler.

**Chrome Performance tab** profiles CPU time, paints and layout. It cannot tell you
that `ProductCard` re-rendered because `badge` is a new object with the same value.
Use both: Chrome for *where the time went*, this package for *why it happened*.
