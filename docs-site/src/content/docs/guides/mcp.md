---
title: AI agents (MCP)
description: Let an AI agent ask the running app which components re-render and why.
---

`vue-why-render-mcp` lets an AI agent (Claude Code, Cursor, ...) ask your running app which components re-render and why, take a baseline and diff it after a change. Turn it on in the app (dev only), then register the server:

```ts
app.use(VueWhyRender, { mcp: true })  // Nuxt: whyRender: { mcp: true }
```

```bash
claude mcp add vue-why-render -- npx -y vue-why-render-mcp
```

Cursor, `.cursor/mcp.json`:

```json
{ "mcpServers": { "vue-why-render": { "command": "npx", "args": ["-y", "vue-why-render-mcp"] } } }
```

Open the page in the browser and ask the agent to call `status`. Node 20 or newer.

A custom address for the bridge in the app: `mcp: { port: 7711, host: 'localhost' }`.

## Tools

| Tool | What it does |
| --- | --- |
| `status` | Is an app connected, page title, URL, Vue and package versions. |
| `report` | Render report: components, counts, reasons. Optional `limit` (1-100) and `component` filter. |
| `component` | Details for one component by `name`: instances, reasons, prop changes, hints. |
| `reset` | Clears the counters in the app. |
| `baseline` | Saves the current report to compare against later, then resets the counters. |
| `diff` | Compares the current report with the baseline. Optional `limit`. |

Everything that comes from the page (component names, values, URLs) is wrapped in a `<page-data>` block and marked as data, not instructions.

## Configuration

| Flag | Environment variable | Default |
| --- | --- | --- |
| `--port <n>` | `VWR_MCP_PORT` | `7711` |
| `--host <host>` | `VWR_MCP_HOST` | `localhost` |
| `--allow-origin <host>` (repeatable) | `VWR_MCP_ALLOW_ORIGIN` (comma separated) | none |

Flags override environment variables. The app must use the same port: `mcp: { port }`.

Only pages from `localhost`, `127.0.0.1`, `[::1]` and `*.localhost` can connect. If you open the app on another host (a LAN address, a tunnel), add it with `--allow-origin`.

If the port is taken (usually by another agent session running this server), the server still starts and `status` says so. Close the other session or pick another port.

The server writes only MCP protocol to stdout; logs go to stderr.
