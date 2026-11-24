---
title: VS Code 扩展
description: 在 VS Code 中直接查看组件树、依赖、.vue 文件里的渲染次数，以及扫描器命令。
---

Vue Why Render 扩展让你不离开 VS Code 就能看到哪些组件在重新渲染、原因是什么、
频率有多高。应用通过本地 WebSocket 把数据发送给扩展。

## 它能做什么

- **组件树**：侧边栏面板，列出被追踪的组件，按渲染次数排序。
- **依赖**：响应式来源（ref、props、store）以及使用它们的组件。
- **CodeLens**：在 `.vue` 文件的组件上方显示渲染次数和平均耗时。
- **状态栏**：总渲染次数和热点组件的数量。
- **命令**：在命令面板中连接、断开、暂停、恢复和重置扫描器。

## 设置

1. 安装扩展。
2. 在应用中通过 `vscode` 选项开启桥接：

```ts
import { scan } from 'vue-why-render'

scan(app, {
    vscode: true,        // 连接到端口 7710 上的 VS Code
    // vscode: { port: 8080 }  // 自定义端口
})
```

3. 扩展会在端口 7710 上启动 WebSocket 服务器，等待应用连接。
   浏览器一侧每 3 秒自动重连，因此应用和 VS Code 谁先启动都无所谓。

## 配置

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `vueWhyRender.port` | `7710` | WebSocket 端口 |
| `vueWhyRender.autoConnect` | `true` | 激活时开始监听 |

如果修改了端口，应用里也要同步修改：`vscode: { port }`。

## 命令

| 命令 | 说明 |
| --- | --- |
| `Why Render: Connect to App` | 启动 WebSocket 服务器 |
| `Why Render: Disconnect` | 停止服务器 |
| `Why Render: Pause Scanner` | 暂停数据收集 |
| `Why Render: Resume Scanner` | 恢复数据收集 |
| `Why Render: Reset Counters` | 重置所有渲染计数器 |
