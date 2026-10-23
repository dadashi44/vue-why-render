import { WebSocketServer, WebSocket } from 'ws'

export interface ComponentSnapshot {
    uid: number
    name: string
    file?: string
    renderCount: number
    updateCount: number
    totalDuration: number
    maxDuration: number
    lastDuration: number
    lastReasons: Array<{ source: string, key: string, oldValue?: string, newValue?: string }>
    lastPropChanges: Array<{ key: string, referenceOnly: boolean, newFunction: boolean }>
}

export interface SnapshotPayload {
    records: ComponentSnapshot[]
    paused: boolean
}

export interface DepNode {
    id: string
    label: string
    source: string
    store?: string
}

export interface DepEdge {
    componentUid: number
    dep: DepNode
    reads: number
    triggers: number
}

export interface DepsPayload {
    nodes: DepNode[]
    edges: DepEdge[]
    components: Array<{ uid: number, name: string, file?: string }>
}

interface BridgeMessage {
    type: string
    payload: unknown
}

export class Server {
    private wss: WebSocketServer | null = null
    private clients = new Set<WebSocket>()

    constructor(
        private readonly onSnapshot: (data: SnapshotPayload) => void,
        private readonly onDeps: (data: DepsPayload) => void,
    ) {}

    start(port: number): void {
        this.stop()
        this.wss = new WebSocketServer({ port, host: 'localhost' })

        this.wss.on('connection', (ws) => {
            this.clients.add(ws)
            ws.on('message', (raw) => {
                try {
                    const msg = JSON.parse(String(raw)) as BridgeMessage
                    if (msg.type === 'snapshot') this.onSnapshot(msg.payload as SnapshotPayload)
                    else if (msg.type === 'deps') this.onDeps(msg.payload as DepsPayload)
                } catch { /* ignore */ }
            })
            ws.on('close', () => this.clients.delete(ws))
            ws.on('error', () => this.clients.delete(ws))
        })

        this.wss.on('error', () => {})
    }

    stop(): void {
        for (const client of this.clients) client.close()
        this.clients.clear()
        this.wss?.close()
        this.wss = null
    }

    sendCommand(cmd: string): void {
        const msg = JSON.stringify({ type: 'command', payload: cmd })
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN) client.send(msg)
        }
    }

    get connected(): boolean {
        return this.clients.size > 0
    }
}
