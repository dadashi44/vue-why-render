import * as vscode from 'vscode'
import type { DepNode, DepsPayload } from './server'

interface DepItem {
    node: DepNode
    dependents: number
    totalTriggers: number
}

export class DepsProvider implements vscode.TreeDataProvider<DepItem> {
    private items: DepItem[] = []
    private readonly _onDidChange = new vscode.EventEmitter<void>()
    readonly onDidChangeTreeData = this._onDidChange.event

    update(deps: DepsPayload): void {
        this.items = deps.nodes
            .map(node => {
                const edges = deps.edges.filter(e => e.dep.id === node.id)
                return {
                    node,
                    dependents: edges.length,
                    totalTriggers: edges.reduce((s, e) => s + e.triggers, 0),
                }
            })
            .filter(d => d.dependents > 0)
            .sort((a, b) => b.totalTriggers - a.totalTriggers || b.dependents - a.dependents)
        this._onDidChange.fire()
    }

    clear(): void {
        this.items = []
        this._onDidChange.fire()
    }

    getTreeItem(el: DepItem): vscode.TreeItem {
        const item = new vscode.TreeItem(el.node.label, vscode.TreeItemCollapsibleState.None)

        const parts = [`${el.dependents} comp`]
        if (el.totalTriggers > 0) parts.push(`${el.totalTriggers} triggers`)
        item.description = `[${el.node.source}]  ${parts.join('  ')}`

        const iconMap: Record<string, string> = {
            props: 'symbol-property',
            setup: 'symbol-variable',
            store: 'database',
            computed: 'symbol-function',
            route: 'globe',
            data: 'symbol-field',
            array: 'symbol-array',
            collection: 'symbol-class',
        }
        item.iconPath = new vscode.ThemeIcon(iconMap[el.node.source] ?? 'symbol-misc')

        item.tooltip = new vscode.MarkdownString()
        item.tooltip.appendMarkdown(`**${el.node.label}**  \n`)
        item.tooltip.appendMarkdown(`Source: ${el.node.source}  \n`)
        if (el.node.store) item.tooltip.appendMarkdown(`Store: ${el.node.store}  \n`)
        item.tooltip.appendMarkdown(`Used by ${el.dependents} components  \n`)
        item.tooltip.appendMarkdown(`Triggered ${el.totalTriggers} re-renders`)

        return item
    }

    getChildren(): DepItem[] {
        return this.items
    }
}
