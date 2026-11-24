import { WebSocketServer, type WebSocket } from 'ws'
import { isAllowedOrigin } from './origin.js'

/** Duplicate of the browser-side AppInfo (no runtime import from the main package). */
export interface AppInfo {
    url?: string
    title?: string
    vue: boolean
    version: string
    paused: boolean
}

export type ConnectionStatus = 'listening' | 'port-in-use'

export interface AppConnectionOptions {
    port: number
    host: string
    allowOrigins: string[]
    timeoutMs: number
}

interface Pending {
    resolve: (value: unknown) => void
    reject: (err: Error) => void
    timer: ReturnType<typeof setTimeout>
}

const NOT_CONNECTED =
    'No app connected. Enable `mcp: true` in the vue-why-render plugin (Nuxt: `whyRender: { mcp: true }`) and open the page in dev mode.'

export class AppConnection {
    readonly port: number
    private wss: WebSocketServer | null = null
    private socket: WebSocket | null = null
    private _status: ConnectionStatus = 'listening'
    private pending = new Map<string, Pending>()
    private counter = 0

    constructor(private opts: AppConnectionOptions) {
        this.port = opts.port
    }

    get status(): ConnectionStatus {
        return this._status
    }

    get connected(): boolean {
        return this.socket !== null && this.socket.readyState === 1
    }

    start(): Promise<ConnectionStatus> {
        return new Promise((resolve, reject) => {
            const wss = new WebSocketServer({
                port: this.opts.port,
                host: this.opts.host,
                verifyClient: (info: { origin: string }) => isAllowedOrigin(info.origin, this.opts.allowOrigins),
            })
            wss.once('error', (err: NodeJS.ErrnoException) => {
                if (err.code === 'EADDRINUSE') {
                    this._status = 'port-in-use'
                    wss.close()
                    resolve('port-in-use')
                } else reject(err)
            })
            wss.once('listening', () => {
                this.wss = wss
                this._status = 'listening'
                wss.on('error', () => {})
                wss.on('connection', ws => this.attach(ws))
                resolve('listening')
            })
        })
    }

    private attach(ws: WebSocket): void {
        const old = this.socket
        this.socket = ws
        if (old) {
            this.rejectAll(new Error('Connection replaced by a newer page'))
            old.close()
        }
        ws.on('message', raw => this.onMessage(String(raw)))
        ws.on('error', () => {})
        ws.on('close', () => {
            if (this.socket === ws) {
                this.socket = null
                this.rejectAll(new Error('App connection closed'))
            }
        })
    }

    private onMessage(raw: string): void {
        let msg: any
        try {
            msg = JSON.parse(raw)
        } catch {
            return
        }
        if (!msg || msg.type !== 'response' || typeof msg.id !== 'string') return
        const p = this.pending.get(msg.id)
        if (!p) return
        this.pending.delete(msg.id)
        clearTimeout(p.timer)
        const payload = msg.payload
        if (payload && payload.ok) p.resolve(payload.result)
        else p.reject(new Error(String(payload?.error ?? 'Unknown error')))
    }

    private rejectAll(err: Error): void {
        for (const [id, p] of this.pending) {
            clearTimeout(p.timer)
            p.reject(err)
            this.pending.delete(id)
        }
    }

    request<T>(method: string, params?: unknown): Promise<T> {
        if (this._status === 'port-in-use') {
            return Promise.reject(
                new Error(
                    `Port ${this.opts.port} is used by another vue-why-render-mcp process (another agent session?). Close it, or set another port: VWR_MCP_PORT on the server and \`mcp: { port }\` in the app.`,
                ),
            )
        }
        const ws = this.socket
        if (!ws || ws.readyState !== 1) return Promise.reject(new Error(NOT_CONNECTED))
        const id = String(++this.counter)
        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id)
                reject(new Error(`Request "${method}" timed out after ${this.opts.timeoutMs} ms`))
            }, this.opts.timeoutMs)
            this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer })
            ws.send(JSON.stringify({ type: 'request', id, payload: { method, params } }), err => {
                if (err) {
                    clearTimeout(timer)
                    this.pending.delete(id)
                    reject(err)
                }
            })
        })
    }

    close(): Promise<void> {
        this.rejectAll(new Error('Server closed'))
        const wss = this.wss
        this.wss = null
        this.socket = null
        if (!wss) return Promise.resolve()
        for (const c of wss.clients) c.terminate()
        return new Promise(resolve => wss.close(() => resolve()))
    }
}
