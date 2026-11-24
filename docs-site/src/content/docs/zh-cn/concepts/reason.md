---
title: 原因是如何判定的
description: vue-why-render 如何把 Vue 的 renderTriggered 事件翻译成人话。
---

一个全局 mixin 为每个组件挂上 `renderTriggered`。Vue 会向它传入
`{ target, type, key, oldValue, newValue }` —— 即目标对象、键名，以及变更前后的值。
本包据此把它翻译成人话：

- `target === instance.props` → 这是一个 **prop**；
- 目标位于某个 Pinia store 的状态中 → **store** 及其内部路径（`cart.items`、`cart.meta.open`），见 [Pinia](/docs/zh-cn/guides/pinia/)；
- 目标是 ref 且键名为 `value` → 到 `setupState` 里反查变量名，显示 **state count**，
  而不是毫无意义的 `value`；
- 数组 → `[3]`；`Map` 或 `Set` → 集合；
- 目标是路由器的当前路由 → **路由**变化，按变化的部分命名（`params.id`、`query.tab`），见 [Vue Router](/docs/zh-cn/guides/router/)；
- 完全没有目标 → **计算属性**。Vue 3.5 在通知组件计算属性变化时不附带任何调试信息，因此本包会遍历组件自身的依赖，找出刚刚失效的计算属性，并按 `setupState` 中的名字称呼它 —— **计算属性 total**。在组件外、composable 或 store 中声明的计算属性无名可取，只显示为 **计算属性**。

除此之外，还会独立地在相邻两次更新之间比对 props。正是这一步能抓住「父组件每次都传下来
一个新建字面量」的情况。
