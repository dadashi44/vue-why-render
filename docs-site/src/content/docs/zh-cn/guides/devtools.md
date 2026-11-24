---
title: Vue DevTools 与 Nuxt DevTools
description: Vue DevTools 中的 Why render 检查器与时间线图层，以及 Nuxt DevTools 中的 Why render 标签页。
---

## Vue DevTools

如果安装了扩展，本包也会在其中注册：组件树旁边会出现 **Why render** 检查器，
时间线上会出现 **Why render** 图层，每次渲染对应一个事件。

检查器按渲染次数列出组件；选中某个组件即可看到它最后一次渲染的原因、prop 的差异和提示。
无需任何配置 —— DevTools 打开时它就在，不打开时它什么也不花费。

```ts
app.use(VueWhyRender, { devtools: false })   // 只想要自带面板时
```

**如果检查器没有出现**，原因通常不在本包。Vue DevTools 有一个 **High Performance Mode**，
只要它处于开启状态，任何第三方检查器都不会被创建 —— 本包的不会，Pinia 的不会，路由的也不会。
这道关卡位于 `@vue/devtools-kit` 中：

```js
if (devtoolsState.highPerfModeEnabled && !options?.inspectingComponent) return
```

在 Vue 标签页的设置里关掉它，然后刷新页面。第二个条件是 Vue 标签页必须处于打开状态：
插件是在 DevTools 客户端连接时才被实例化的，在那之前注册只是待在队列里。

这并不会取代自带面板，面板也不会被移除。扩展并非到处都能装：内网环境、演示时别人的浏览器、
WebView。面板在没有 DevTools 的地方工作，而 DevTools 在它存在的地方更顺手。

**没有引入新依赖。** 常规做法是使用 `@vue/devtools-api`，但它在第 8 版会带上
`@vue/devtools-kit`。整个接入点其实只是 `window.__VUE_DEVTOOLS_GLOBAL_HOOK__` 上的一个事件，
因此这段桥接是自己写的 —— 大约二十行，本包依旧保持零运行时依赖。

## Nuxt DevTools

[Nuxt 模块](/docs/zh-cn/start/nuxt/)会在 Nuxt DevTools 中添加一个 **Why render** 标签页 —— 同一个面板，实时更新，铺满整个标签页，
与其他工具并列。已在 DevTools 3.4 上验证；DevTools 4.0（仍在 beta）通过同一个 hook 收集模块标签页。不增加任何依赖：标签页是开发服务器提供的一个页面，
其中的面板由应用自己的 Vue 通过 `window.__VUE_WHY_RENDER__` 绘制。

如果浮动面板碍事，可以只保留标签页：

```ts
whyRender: { panel: false },        // DevTools 标签页依然可用
whyRender: { devtoolsTab: false },  // 或者反过来
```

`devtoolsTab` 只存在于 `nuxt.config` 中：标签页由构建注册，而不是由应用注册。
