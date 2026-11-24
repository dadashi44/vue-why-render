---
title: Options
description: Every option of the vue-why-render plugin, with defaults.
---

Pass options to `app.use(VueWhyRender, options)`, to `scan(app, options)`, or under
the `whyRender` key in `nuxt.config`.

| Option | Default | What it does |
| --- | --- | --- |
| `enabled` | `true` | Turns the scanner on. The package never guesses the build mode — see [Cost](/docs/concepts/cost/). |
| `overlay` | `true` | Borders around re-rendered components. |
| `panel` | `true` | Floating statistics panel. |
| `devtools` | `true` | Register an inspector and a timeline layer in Vue DevTools. |
| `showLabels` | `true` | Component name label on the border. |
| `includeMounts` | `false` | Report first mounts as well as updates. |
| `trackReasons` | `true` | Collect reasons through `renderTriggered`. |
| `trackProps` | `true` | Diff props between updates. |
| `include` | `[]` | Watch only these components: a string, a regexp or a function. |
| `exclude` | `[]` | Leave these components alone. Beats `include`. |
| `minDuration` | `0` | Ignore updates faster than this, in ms. |
| `hotThreshold` | `5` | How many renders per second count as "hot". |
| `maxEvents` | `500` | Size of the ring buffer of events. |
| `flushInterval` | `250` | How often the panel pulls a fresh snapshot, in ms. |
| `displayDuration` | `600` | How long a border stays visible, in ms. |
| `openInEditorUrl` | `/__open-in-editor?file={file}` | Template for the open-in-editor link, see [Opening files in your editor](/docs/guides/editor/). |
| `locale` | `'en'` | Panel language: `en`, `ru` or `zh-CN`. |
| `theme` | `'auto'` | Panel theme: `auto` follows `prefers-color-scheme`, or force `dark` / `light`. |
| `pauseHotkey` | `'Alt+Shift+P'` | Shortcut that pauses and resumes recording, even with the panel off. `false` binds nothing. |
| `sampleRate` | `1` | Share of renders to record, `0`–`1`. On apps with thousands of components `0.1` keeps every tenth and skips the rest of the work. Counts become sampled — the panel header and the report say so. |
| `budgets` | `[]` | Render budgets, see [Budgets](/docs/guides/budgets/). |
| `pinia` | `true` | Recognise Pinia stores and the actions that change them. Pinia does not have to be a dependency. |
| `router` | `true` | Recognise Vue Router navigation and name what changed in the route. The router does not have to be a dependency. |
| `vscode` | `false` | Connect to the VS Code extension over WebSocket: `true` for port 7710, or `{ port, host }`. See [VS Code extension](/docs/guides/vscode/). |
| `mcp` | `false` | Connect to the vue-why-render MCP server over WebSocket: `true` for port 7711, or `{ port, host }`. See [AI agents (MCP)](/docs/guides/mcp/). |
| `onBudgetExceeded` | — | Called on the first violation of each component. |
| `onRender` | — | Callback fired on every render event. |
