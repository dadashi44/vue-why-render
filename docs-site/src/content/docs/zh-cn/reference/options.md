---
title: 配置项
description: vue-why-render 插件的全部配置项及其默认值。
---

配置项可传给 `app.use(VueWhyRender, options)`、`scan(app, options)`，或写在 `nuxt.config` 的
`whyRender` 键下。

| 配置项 | 默认值 | 作用 |
| --- | --- | --- |
| `enabled` | `true` | 启用扫描器。本包不会去猜测构建模式 —— 参见[开销](/docs/zh-cn/concepts/cost/)。 |
| `overlay` | `true` | 在重新渲染的组件周围绘制边框。 |
| `panel` | `true` | 浮动统计面板。 |
| `devtools` | `true` | 在 Vue DevTools 中注册检查器与时间线图层。 |
| `showLabels` | `true` | 在边框上显示组件名标签。 |
| `includeMounts` | `false` | 除更新外，也记录首次挂载。 |
| `trackReasons` | `true` | 通过 `renderTriggered` 收集原因。 |
| `trackProps` | `true` | 在相邻更新之间比对 props。 |
| `include` | `[]` | 只监视这些组件：字符串、正则或函数。 |
| `exclude` | `[]` | 忽略这些组件。优先级高于 `include`。 |
| `minDuration` | `0` | 忽略快于该毫秒数的更新。 |
| `hotThreshold` | `5` | 每秒多少次渲染算作「过热」。 |
| `maxEvents` | `500` | 事件环形缓冲区的大小。 |
| `flushInterval` | `250` | 面板拉取新快照的间隔，毫秒。 |
| `displayDuration` | `600` | 边框保持可见的时长，毫秒。 |
| `openInEditorUrl` | `/__open-in-editor?file={file}` | 在编辑器中打开文件的链接模板，见[在编辑器中打开文件](/docs/zh-cn/guides/editor/)。 |
| `locale` | `'en'` | 面板语言：`en`、`ru` 或 `zh-CN`。 |
| `theme` | `'auto'` | 面板主题：`auto` 跟随 `prefers-color-scheme`，也可强制 `dark` / `light`。 |
| `pauseHotkey` | `'Alt+Shift+P'` | 暂停 / 继续记录的快捷键，关闭面板时同样有效。`false` 表示不绑定。 |
| `sampleRate` | `1` | 记录的渲染比例，`0`–`1`。组件数以千计时，`0.1` 只记录十分之一，其余的工作全部跳过。此时计数是采样值 —— 面板标题和报告都会注明。 |
| `budgets` | `[]` | 渲染预算，见[预算](/docs/zh-cn/guides/budgets/)。 |
| `pinia` | `true` | 识别 Pinia store 以及修改它们的 action。无需把 Pinia 作为依赖。 |
| `router` | `true` | 识别 Vue Router 导航，并指出路由中具体变化了什么。无需把路由器作为依赖。 |
| `vscode` | `false` | 通过 WebSocket 连接 VS Code 扩展：`true` 使用端口 7710，或传入 `{ port, host }`。见 [VS Code 扩展](/docs/zh-cn/guides/vscode/)。 |
| `mcp` | `false` | 通过 WebSocket 连接 vue-why-render 的 MCP 服务器：`true` 使用端口 7711，或传入 `{ port, host }`。见 [AI 代理 (MCP)](/docs/zh-cn/guides/mcp/)。 |
| `onBudgetExceeded` | — | 每个组件第一次超出预算时调用。 |
| `onRender` | — | 每次渲染事件触发的回调。 |
