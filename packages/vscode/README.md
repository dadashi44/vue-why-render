# Vue Why Render — VS Code Extension

See which Vue components re-render, why, and how often — right in VS Code.

## Features

- **Component tree** — sidebar panel listing all tracked components sorted by render count
- **Dependencies view** — reactive sources (refs, props, stores) and which components use them
- **CodeLens** — render count annotations directly on `.vue` files
- **Status bar** — live render count and hot component warnings
- **Commands** — pause, resume, reset the scanner from the command palette

## Setup

1. Install the extension
2. Add `vscode: true` to your vue-why-render config:

```ts
import { scan } from 'vue-why-render'

scan(app, {
    vscode: true,        // connect to VS Code on port 7710
    // vscode: { port: 8080 }  // custom port
})
```

3. The extension starts a WebSocket server on port 7710 (configurable) and waits for the app to connect.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `vueWhyRender.port` | `7710` | WebSocket port |
| `vueWhyRender.autoConnect` | `true` | Start listening on activation |

## Commands

| Command | Description |
|---------|-------------|
| `Why Render: Connect to App` | Start the WebSocket server |
| `Why Render: Disconnect` | Stop the server |
| `Why Render: Pause Scanner` | Pause data collection |
| `Why Render: Resume Scanner` | Resume data collection |
| `Why Render: Reset Counters` | Reset all render counters |
