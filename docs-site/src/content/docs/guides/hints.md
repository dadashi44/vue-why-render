---
title: Hints
description: Next to every reason, what to do about it — four patterns recognised from runtime data alone.
---

Next to the reason, the panel prints what to do about it:

```
ProductCard ×7
prop badge: { text } → { text } — new reference, same value
💡 badge: looks like this object is rebuilt in the parent — hoist it into a constant or a computed
```

Four patterns are recognised, all of them from runtime data alone:

| What the data shows | The hint |
| --- | --- |
| A prop changed by reference only, the value is equal | the object is rebuilt in the parent — hoist it |
| A prop is a function and it is a different one every render | the handler is recreated — move it into a method |
| The component re-rendered with no reasons and no prop changes | the parent drove it — a candidate for `v-memo` |
| The reason is a route change | reading the route subscribes to every navigation — wrap the one field in `computed` |

**Hints are hypotheses, not diagnoses.** The package knows a prop arrived as a new
reference; it does not know where from — an inline call in the template, a computed
without memoisation, or a store. That is why the wording hedges, and why a hint is
never printed when it cannot be derived honestly:

- `trackProps: false` or `trackReasons: false` — "nothing changed" would mean "we were not looking", so no `v-memo` hint;
- a component that only ever mounted gets no hint at all: suggesting memoisation for something that never updated is worse than saying nothing.

Hints are also attached to every component in a saved report, under `hints`.

The route hint is explained in Vue Router.
