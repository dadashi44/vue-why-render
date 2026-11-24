# vue-why-render-mcp

MCP server that lets AI agents (Claude Code, Cursor, ...) ask a running Vue app which components re-render and why. It talks to the page through [vue-why-render](https://github.com/dadashi44/vue-why-render) over a local WebSocket.

## Setup

1. Enable the bridge in the app (dev only):

   ```ts
   app.use(VueWhyRender, { mcp: true })  // Nuxt: whyRender: { mcp: true }
   ```

   Custom address: `mcp: { port: 7711, host: 'localhost' }`.

2. Register the server.

   Claude Code:

   ```bash
   claude mcp add vue-why-render -- npx -y vue-why-render-mcp
   ```

   Cursor, `.cursor/mcp.json`:

   ```json
   { "mcpServers": { "vue-why-render": { "command": "npx", "args": ["-y", "vue-why-render-mcp"] } } }
   ```

3. Open the page in the browser and ask the agent to call `status`.

Node 20 or newer.

## Tools

| Tool | What it does |
| --- | --- |
| `status` | Is an app connected, page title, URL, Vue and package versions. |
| `report` | Render report: components, counts, reasons. Optional `limit` (1-100) and `component` filter. |
| `component` | Details for one component by `name`: instances, reasons, prop changes, hints. |
| `reset` | Clears the counters in the app. |
| `baseline` | Saves the current report to compare against later. |
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
