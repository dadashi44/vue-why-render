---
title: AI 代理 (MCP)
description: 让 AI 代理询问正在运行的应用：哪些组件在重新渲染，以及原因。
---

`vue-why-render-mcp` 让 AI 代理（Claude Code、Cursor 等）可以向正在运行的应用询问哪些组件在重新渲染以及原因，保存基线并在修改后对比。先在应用中开启该选项（仅开发环境），再注册服务器：

```ts
app.use(VueWhyRender, { mcp: true })  // Nuxt: whyRender: { mcp: true }
```

```bash
claude mcp add vue-why-render -- npx -y vue-why-render-mcp
```

Cursor，`.cursor/mcp.json`：

```json
{ "mcpServers": { "vue-why-render": { "command": "npx", "args": ["-y", "vue-why-render-mcp"] } } }
```

在浏览器中打开页面，然后让代理调用 `status`。需要 Node 20 或更高版本。

在应用中自定义桥接地址：`mcp: { port: 7711, host: 'localhost' }`。

## 工具

| 工具 | 作用 |
| --- | --- |
| `status` | 是否已连接应用、页面标题、URL、Vue 与本包的版本。 |
| `report` | 渲染报告：组件、次数、原因。可选 `limit` (1-100) 和 `component` 过滤。 |
| `component` | 按 `name` 查看单个组件的详情：实例、原因、props 变化、提示。 |
| `reset` | 清零应用中的计数器。 |
| `baseline` | 保存当前报告作为之后对比的基线，然后清零计数器。 |
| `diff` | 把当前报告与基线对比。可选 `limit`。 |

来自页面的一切内容（组件名、值、URL）都会被包进 `<page-data>` 块，并标明是数据而不是指令。

## 配置

| 参数 | 环境变量 | 默认值 |
| --- | --- | --- |
| `--port <n>` | `VWR_MCP_PORT` | `7711` |
| `--host <host>` | `VWR_MCP_HOST` | `localhost` |
| `--allow-origin <host>`（可重复） | `VWR_MCP_ALLOW_ORIGIN`（逗号分隔） | 无 |

命令行参数优先于环境变量。应用必须使用同一个端口：`mcp: { port }`。

只有来自 `localhost`、`127.0.0.1`、`[::1]` 和 `*.localhost` 的页面可以连接。如果你在其他主机上打开应用（局域网地址、隧道），请用 `--allow-origin` 加入。

如果端口被占用（通常是另一个运行本服务器的代理会话），服务器仍会启动，`status` 会说明这一点。请关闭另一个会话或换一个端口。

服务器只向 stdout 写 MCP 协议内容，日志输出到 stderr。
