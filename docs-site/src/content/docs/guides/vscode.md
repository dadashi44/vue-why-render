---
title: VS Code extension
description: Component tree, dependencies, render counts in .vue files and scanner commands, right in VS Code.
---

The Vue Why Render extension shows which components re-render, why, and how often,
without leaving VS Code. The app streams its data to the extension over a local
WebSocket.

## What it does

- **Component tree**: a sidebar panel listing the tracked components, sorted by render count.
- **Dependencies**: the reactive sources (refs, props, stores) and the components that use them.
- **CodeLens**: render count and average duration above components in `.vue` files.
- **Status bar**: the total render count and the number of hot components.
- **Commands**: connect, disconnect, pause, resume and reset the scanner from the command palette.

## Setup

1. Install the extension.
2. Turn on the bridge in the app with the `vscode` option:

```ts
import { scan } from 'vue-why-render'

scan(app, {
    vscode: true,        // connect to VS Code on port 7710
    // vscode: { port: 8080 }  // custom port
})
```

3. The extension starts a WebSocket server on port 7710 and waits for the app to connect.
   The browser side reconnects by itself every 3 seconds, so the order of starting the
   app and VS Code does not matter.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `vueWhyRender.port` | `7710` | WebSocket port |
| `vueWhyRender.autoConnect` | `true` | Start listening on activation |

If you change the port, change it in the app too: `vscode: { port }`.

## Commands

| Command | Description |
| --- | --- |
| `Why Render: Connect to App` | Start the WebSocket server |
| `Why Render: Disconnect` | Stop the server |
| `Why Render: Pause Scanner` | Pause data collection |
| `Why Render: Resume Scanner` | Resume data collection |
| `Why Render: Reset Counters` | Reset all render counters |
