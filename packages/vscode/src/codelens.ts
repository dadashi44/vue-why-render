import * as vscode from 'vscode'
import type { ComponentSnapshot, SnapshotPayload } from './server'
import * as path from 'path'

export class RenderCodeLens implements vscode.CodeLensProvider {
    private records: ComponentSnapshot[] = []
    private readonly _onDidChange = new vscode.EventEmitter<void>()
    readonly onDidChangeCodeLenses = this._onDidChange.event

    update(snapshot: SnapshotPayload): void {
        this.records = snapshot.records
        this._onDidChange.fire()
    }

    clear(): void {
        this.records = []
        this._onDidChange.fire()
    }

    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        const filePath = document.uri.fsPath
        const matching = this.records.filter(r =>
            r.file && this.fileMatches(r.file, filePath),
        )

        if (matching.length === 0) return []

        const lenses: vscode.CodeLens[] = []

        for (const record of matching) {
            const scriptLine = this.findScriptLine(document)
            const range = new vscode.Range(scriptLine, 0, scriptLine, 0)
            const avg = record.renderCount > 0
                ? (record.totalDuration / record.renderCount).toFixed(1)
                : '0'

            const hot = record.renderCount >= 10 ? ' 🔥' : ''

            lenses.push(new vscode.CodeLens(range, {
                title: `${record.name}: ×${record.renderCount} renders, avg ${avg}ms${hot}`,
                command: '',
            }))

            if (record.lastReasons.length > 0) {
                const reason = record.lastReasons[0]
                lenses.push(new vscode.CodeLens(range, {
                    title: `  last: ${reason.source} ${reason.key}`,
                    command: '',
                }))
            }
        }

        return lenses
    }

    private fileMatches(recordFile: string, documentPath: string): boolean {
        const normalized = path.normalize(recordFile)
        if (documentPath === normalized) return true
        if (documentPath.endsWith(recordFile)) return true
        const baseName = path.basename(documentPath)
        const recordBase = path.basename(recordFile)
        return baseName === recordBase
            && path.dirname(documentPath).endsWith(path.dirname(recordFile))
    }

    private findScriptLine(document: vscode.TextDocument): number {
        for (let i = 0; i < Math.min(document.lineCount, 30); i++) {
            const text = document.lineAt(i).text
            if (text.includes('<script')) return i
        }
        return 0
    }
}
