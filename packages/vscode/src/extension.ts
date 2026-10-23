import * as vscode from 'vscode'
import { Server } from './server'
import { ComponentsProvider } from './components-provider'
import { DepsProvider } from './deps-provider'
import { StatusBar } from './status-bar'
import { RenderCodeLens } from './codelens'

let server: Server | null = null

export function activate(context: vscode.ExtensionContext): void {
    const componentsProvider = new ComponentsProvider()
    const depsProvider = new DepsProvider()
    const statusBar = new StatusBar()
    const codeLens = new RenderCodeLens()

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('vwr.components', componentsProvider),
        vscode.window.registerTreeDataProvider('vwr.deps', depsProvider),
        vscode.languages.registerCodeLensProvider(
            { language: 'vue', scheme: 'file' },
            codeLens,
        ),
        statusBar,
    )

    server = new Server(
        (snapshot) => {
            componentsProvider.update(snapshot)
            codeLens.update(snapshot)
            statusBar.update(snapshot)
        },
        (deps) => {
            depsProvider.update(deps)
        },
    )

    context.subscriptions.push(
        vscode.commands.registerCommand('vwr.connect', () => {
            const port = vscode.workspace.getConfiguration('vueWhyRender').get<number>('port', 7710)
            server?.start(port)
            vscode.window.showInformationMessage(`Why Render: listening on port ${port}`)
        }),
        vscode.commands.registerCommand('vwr.disconnect', () => {
            server?.stop()
            componentsProvider.clear()
            depsProvider.clear()
            statusBar.clear()
            codeLens.clear()
            vscode.window.showInformationMessage('Why Render: disconnected')
        }),
        vscode.commands.registerCommand('vwr.pause', () => server?.sendCommand('pause')),
        vscode.commands.registerCommand('vwr.resume', () => server?.sendCommand('resume')),
        vscode.commands.registerCommand('vwr.reset', () => server?.sendCommand('reset')),
    )

    const autoConnect = vscode.workspace.getConfiguration('vueWhyRender').get<boolean>('autoConnect', true)
    if (autoConnect) {
        const port = vscode.workspace.getConfiguration('vueWhyRender').get<number>('port', 7710)
        server.start(port)
    }
}

export function deactivate(): void {
    server?.stop()
    server = null
}
