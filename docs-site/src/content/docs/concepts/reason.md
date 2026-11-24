---
title: How the reason is determined
description: How vue-why-render turns Vue's renderTriggered event into a plain-language reason.
---

A global mixin attaches `renderTriggered` to every component. Vue passes it
`{ target, type, key, oldValue, newValue }` — the object, the key, and the values before
and after. From there the package translates it into plain language:

- `target === instance.props` → a **prop**;
- the target lives in the state of a Pinia store → a **store** with the path inside it (`cart.items`, `cart.meta.open`), see [Pinia](/docs/guides/pinia/);
- the target is a ref and the key is `value` → look up the variable name in `setupState`
  and report **state count** instead of a useless `value`;
- an array → `[3]`; a `Map` or `Set` → a collection;
- the target is the router's current route → a **route** change, named by what changed (`params.id`, `query.tab`), see [Vue Router](/docs/guides/router/);
- no target at all → a **computed**. Vue 3.5 notifies a component about a computed without any debug info, so the package walks the component's own dependencies for the computeds that just went stale and names them from `setupState` — **computed total**. A computed declared outside the component, in a composable or a store has no name to give, and is reported simply as **computed**.

Independently of all that, props are diffed between consecutive updates. That is what
catches the case where a parent hands down a freshly built literal every time.
