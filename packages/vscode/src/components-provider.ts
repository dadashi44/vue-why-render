import * as vscode from 'vscode'
import type { ComponentSnapshot, SnapshotPayload } from './server'

export class ComponentsProvider implements vscode.TreeDataProvider<ComponentSnapshot> {
    private records: ComponentSnapshot[] = []
    private readonly _onDidChange = new vscode.EventEmitter<void>()
    readonly onDidChangeTreeData = this._onDidChange.event

    update(snapshot: SnapshotPayload): void {
        this.records = snapshot.records
            .slice()
            .sort((a, b) => b.renderCount - a.renderCount)
        this._onDidChange.fire()
    }

    clear(): void {
        this.records = []
        this._onDidChange.fire()
    }

    getTreeItem(el: ComponentSnapshot): vscode.TreeItem {
        const item = new vscode.TreeItem(el.name, vscode.TreeItemCollapsibleState.None)

        const avg = el.renderCount > 0 ? (el.totalDuration / el.renderCount).toFixed(2) : '0'
        item.description = `×${el.renderCount}  avg ${avg}ms  max ${el.maxDuration.toFixed(1)}ms`

        if (el.renderCount >= 10) {
            item.iconPath = new vscode.ThemeIcon('flame', new vscode.ThemeColor('errorForeground'))
        } else if (el.renderCount >= 3) {
            item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'))
        } else {
            item.iconPath = new vscode.ThemeIcon('circle-outline')
        }

        if (el.file) {
            item.tooltip = new vscode.MarkdownString()
            item.tooltip.appendMarkdown(`**${el.name}**  \n`)
            item.tooltip.appendMarkdown(`File: \`${el.file}\`  \n`)
            item.tooltip.appendMarkdown(`Renders: ${el.renderCount} (${el.updateCount} updates)  \n`)
            item.tooltip.appendMarkdown(`Duration: avg ${avg}ms, max ${el.maxDuration.toFixed(1)}ms  \n`)
            if (el.lastReasons.length) {
                item.tooltip.appendMarkdown(`\nLast reasons:  \n`)
                for (const r of el.lastReasons.slice(0, 5)) {
                    item.tooltip.appendMarkdown(`- ${r.source} \`${r.key}\`  \n`)
                }
            }

            item.command = {
                command: 'vscode.open',
                title: 'Open file',
                arguments: [vscode.Uri.file(el.file)],
            }
        }

        return item
    }

    getChildren(): ComponentSnapshot[] {
        return this.records
    }
}
