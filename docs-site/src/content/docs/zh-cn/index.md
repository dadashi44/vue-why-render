---
title: 简介
description: 看清哪些 Vue 组件在重新渲染，以及究竟为什么。
---

看清哪些 Vue 组件在重新渲染 —— 以及**究竟为什么**。

同类工具会在刚更新的组件周围闪一圈边框。这足以让你发现问题，却不足以让你修好它 ——
你依然要问：*到底是什么变了？* `vue-why-render` 回答的正是这个问题：它会指出触发这次
渲染的那个具体的响应式依赖。

```
ProductCard ×7 · 2.4ms · badge
└─ prop badge: { text } → { text } — 新引用，值未变
```

在 React 里这只能靠逐个比对 props 去猜。而 Vue 通过 `renderTriggered` 钩子直接把原因
交给你 —— 本包正是围绕它构建的。

[在线沙盒](https://vue-why-render.js.org/) · [GitHub](https://github.com/dadashi44/vue-why-render)

## 功能

- **给出原因，而不只是结果**：prop、ref、Pinia store 字段或数组下标，连同变更前后的值。
- **单独标注「新引用，值未变」** —— 这是多余渲染最常见的来源。
- **高亮层**：在重新渲染的组件周围绘制边框，颜色按频率从绿到红。
- **面板**：按渲染次数排行、按耗时排行、带子树合计的组件树，以及事件流。
- **跳转到编辑器**：点击一行即可通过开发服务器在 IDE 中打开对应的 SFC。
- **Pinia**：哪个 store、哪个字段，以及当时正在执行的 action —— `store cart.items (add) · action add()`。无需配置，也不依赖 Pinia。
- **Vue Router**：导航按变化的部分命名 —— `路由 params.id: "/p/1" → "/p/42"` —— 当组件在每次导航时都重新渲染，还会给出提示。
- **暂停、重置与过滤**：按组件名或文件路径；`Alt+Shift+P` 可用键盘暂停。面板可拖到任意位置，跟随系统的浅色或深色主题，一键复制原因。
- **Vue DevTools**：在扩展中提供检查器与时间线图层，且不引入新依赖。
- **Nuxt DevTools**：Nuxt 模块提供的 **Why render** 标签页，展示同一个实时面板，无额外依赖。
- **测试断言**：`expectRenders(ProductCard).toBe(0, …)` —— 修好一次的多余渲染不会再回来。
- **提示**：在原因旁边给出该怎么办 —— 提取对象、把处理函数提为方法、考虑 `v-memo`。
- **报告**：面板上一键把整个会话导出为 JSON，再用 `diffReports(before, after)` 证明修复确实奏效。已保存的报告可以重新在面板中打开，会话可以复制为 Markdown 贴进 issue，或通过 `printReport()` 打印到控制台。
- **渲染预算**：`budgets: { maxRenders: 5 }` 会在组件疯狂渲染时发出警告，`window.__VUE_WHY_RENDER__` 让 Playwright 测试可以借此使 CI 失败。
- **API**：`getStats()`、`getEvents()`、`getReport()` 以及 `onRender` 回调，可用于自建工具。
