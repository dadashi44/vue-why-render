import * as vscode from 'vscode'
import type { SnapshotPayload } from './server'

export class StatusBar implements vscode.Disposable {
    private readonly item: vscode.StatusBarItem

    constructor() {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
        this.item.name = 'Why Render'
        this.item.command = 'vwr.components.focus'
        this.item.show()
        this.clear()
    }

    update(snapshot: SnapshotPayload): void {
        const total = snapshot.records.reduce((s, r) => s + r.renderCount, 0)
        const components = snapshot.records.length
        const hot = snapshot.records.filter(r => r.renderCount >= 10).length

        if (snapshot.paused) {
            this.item.text = '$(debug-pause) VWR paused'
            this.item.backgroundColor = undefined
        } else if (hot > 0) {
            this.item.text = `$(flame) ${total} renders · ${hot} hot`
            this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground')
        } else {
            this.item.text = `$(pulse) ${total} renders · ${components} comp`
            this.item.backgroundColor = undefined
        }

        this.item.tooltip = `vue-why-render: ${total} renders across ${components} components`
    }

    clear(): void {
        this.item.text = '$(pulse) VWR waiting...'
        this.item.tooltip = 'vue-why-render: waiting for connection'
        this.item.backgroundColor = undefined
    }

    dispose(): void {
        this.item.dispose()
    }
}
