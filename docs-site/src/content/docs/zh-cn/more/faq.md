---
title: 常见问题
description: 关于 vue-why-render 的常见问题简答。
---

## 如何在 Vue 3 中找出并修复不必要的重新渲染？

把 `vue-why-render` 作为开发依赖安装。它挂接 Vue 的 `renderTriggered`，指出导致每次
重新渲染的具体响应式依赖 —— prop、ref、计算属性或 Pinia store 字段。最常见的原因是传入了
值相同的新对象引用（例如模板中内联的 `{ text }`）；本包会检测到这种情况，并标注为
「新引用，值相同」。

## 它会拖慢我的应用吗？

扫描器依赖 `renderTriggered` 回调，而 Vue 只在开发构建中触发它。在生产环境中，这些钩子
根本不会被调用 —— 零开销。热点路径上的算法在 WebAssembly（Rust）中运行，以尽量降低分析
期间的开销；WASM 不可用时回退到 JS。见[开销](/docs/zh-cn/concepts/cost/)与
[WASM 引擎](/docs/zh-cn/concepts/wasm/)。

## 它支持 Pinia 吗？

支持。当某个 Pinia store 字段触发渲染时，面板会显示 store 名称、字段，以及当时正在运行的
action：`store cart.items (add) · action add()`。无需配置，也不依赖 Pinia。见
[Pinia](/docs/zh-cn/guides/pinia/)。

## 它支持 Vue Router 吗？

支持。一次导航会按变化的部分命名 —— `route params.id: "/p/1" → "/p/42"` —— 而不是展示整个路由
对象。如果某个组件在*每一次*导航时都重新渲染（因为它读取了整个路由），会有提示来警告。见
[Vue Router](/docs/zh-cn/guides/router/)。

## 它支持 Nuxt 吗？

支持。在 Nuxt 配置中加入 `modules: ['vue-why-render/nuxt']`。Nuxt DevTools 中会出现
**Why render** 标签页，里面是实时面板。该模块在生产构建中会自动禁用。见 [Nuxt](/docs/zh-cn/start/nuxt/)。

## 可以在 CI / 自动化测试中使用吗？

可以。本包为 Vitest 导出 `expectRenders(Component).toBe(n, ...)`，并提供渲染预算
（`budgets: { maxRenders: 5 }`），超出的情况会通过 `window.__VUE_WHY_RENDER__` 暴露给
Playwright。修好一次的多余渲染就不会再回来。见
[在测试中断言渲染次数](/docs/zh-cn/guides/tests/)与[预算](/docs/zh-cn/guides/budgets/)。

## 为什么用 WebAssembly？

一个在 JS 堆上分配内存的性能分析工具，会和它所测量的代码受到同样的垃圾回收暂停的影响。
`buildTree` 调用期间的一次 GC 全停顿会让报告的渲染时间虚高 —— 工具扭曲了自己的测量结果。
WASM 线性内存对垃圾回收器不可见：没有 GC 扫描，没有暂停，并借助 Rust 的所有权实现确定性的
内存管理。结果是，相比 JS 路径，最坏情况延迟低 2 倍，抖动减少 2.4 倍。
