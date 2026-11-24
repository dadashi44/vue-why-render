import { WebSocketServer, type WebSocket } from 'ws'
import { isAllowedOrigin } from './origin.js'

/** Duplicate of the browser-side AppInfo (no runtime import from the main package). */
export interface AppInfo {
    url?: string
    title?: string
    vue: string
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

/** Error text that came from the inspected page, so it must be treated as untrusted. */
export class PageError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'PageError'
    }
}

export function portInUseMessage(port: number): string {
    return `Port ${port} is used by another vue-why-render-mcp process (another agent session?). Close it, or set another port: VWR_MCP_PORT on the server and \`mcp: { port }\` in the app.`
}

export const NOT_CONNECTED =
    'No app connected. Enable `mcp: true` in the vue-why-render plugin (Nuxt: `whyRender: { mcp: true }`) and open the page in dev mode.'

export class AppConnection {
    readonly port: number
    private wss: WebSocketServer | null = null
    private sockets: WebSocket[] = []
    private starting: Promise<ConnectionStatus> | null = null
    private _lastRejectedOrigin: string | null = null
    private _status: ConnectionStatus = 'listening'
    private pending = new Map<string, Pending>()
    private counter = 0

    constructor(private opts: AppConnectionOptions) {
        this.port = opts.port
    }

    get status(): ConnectionStatus {
        return this._status
    }

    private get socket(): WebSocket | null {
        return this.sockets[this.sockets.length - 1] ?? null
    }

    get connected(): boolean {
        return this.socket !== null && this.socket.readyState === 1
    }

    /** Number of open page connections; the most recent one answers requests. */
    get clientCount(): number {
        return this.sockets.filter(s => s.readyState === 1).length
    }

    get lastRejectedOrigin(): string | null {
        return this._lastRejectedOrigin
    }

    /** Retries binding the port after another session released it. */
    ensureListening(): Promise<ConnectionStatus> {
        if (this._status !== 'port-in-use') return Promise.resolve(this._status)
        this.starting ??= this.start()
            .catch(() => 'port-in-use' as ConnectionStatus)
            .finally(() => { this.starting = null })
        return this.starting
    }

    start(): Promise<ConnectionStatus> {
        return new Promise((resolve, reject) => {
            const wss = new WebSocketServer({
                port: this.opts.port,
                host: this.opts.host,
                verifyClient: (info: { origin: string }) => {
                    if (isAllowedOrigin(info.origin, this.opts.allowOrigins)) return true
                    this._lastRejectedOrigin = info.origin || '(none)'
                    console.error(`[vue-why-render-mcp] rejected connection from origin ${JSON.stringify(this._lastRejectedOrigin)}`)
                    return false
                },
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
        // Older tabs stay open (their bridges would reconnect and fight for the slot); the newest one answers.
        if (this.sockets.length) this.rejectAll(new Error('Connection replaced by a newer page'))
        this.sockets.push(ws)
        ws.on('message', raw => this.onMessage(String(raw)))
        ws.on('error', () => {})
        ws.on('close', () => {
            const wasActive = this.socket === ws
            this.sockets = this.sockets.filter(s => s !== ws)
            if (wasActive) this.rejectAll(new Error('App connection closed'))
        })
    }

    private onMessage(raw: string): void {
        let msg: unknown
        try {
            msg = JSON.parse(raw)
        } catch {
            return
        }
        if (typeof msg !== 'object' || msg === null) return
        const { type, id, payload } = msg as { type?: unknown, id?: unknown, payload?: unknown }
        if (type !== 'response' || typeof id !== 'string') return
        const p = this.pending.get(id)
        if (!p) return
        this.pending.delete(id)
        clearTimeout(p.timer)
        const body = (typeof payload === 'object' && payload !== null ? payload : {}) as { ok?: unknown, result?: unknown, error?: unknown }
        if (body.ok) p.resolve(body.result)
        else p.reject(new PageError(String(body.error ?? 'Unknown error')))
    }

    private rejectAll(err: Error): void {
        for (const [id, p] of this.pending) {
            clearTimeout(p.timer)
            p.reject(err)
            this.pending.delete(id)
        }
    }

    async request<T>(method: string, params?: unknown): Promise<T> {
        if (await this.ensureListening() === 'port-in-use') throw new Error(portInUseMessage(this.opts.port))
        return this.send<T>(method, params)
    }

    private send<T>(method: string, params?: unknown): Promise<T> {
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
        this.sockets = []
        if (!wss) return Promise.resolve()
        for (const c of wss.clients) c.terminate()
        return new Promise(resolve => wss.close(() => resolve()))
    }
}
