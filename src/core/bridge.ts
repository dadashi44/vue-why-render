import type { Registry } from './registry'
import type { DepsGraph } from './deps-graph'
import type { RenderEvent } from '../types'

export interface BridgeOptions {
    port: number
    host: string
    /**
     * 'stream' — шлёт снапшоты/события/deps (VS Code).
     * 'requests' — ничего не стримит, только отвечает на запросы (MCP).
     */
    mode?: 'stream' | 'requests'
}

export const BRIDGE_DEFAULTS: BridgeOptions = {
    port: 7710,
    host: 'localhost',
}

/** Мост для MCP-сервера: другой порт, только запросы. */
export const MCP_BRIDGE_DEFAULTS: BridgeOptions = {
    port: 7711,
    host: 'localhost',
}

export type BridgeRequestHandler = (method: string, params: unknown) => unknown | Promise<unknown>

interface BridgeMessage {
    type: string
    payload?: unknown
    id?: string
}

/**
 * WebSocket-мост между сканером в браузере и VS Code extension.
 *
 * Браузер — клиент, VS Code — сервер. Данные текут в одну сторону:
 * сканер отправляет снапшоты и события, расширение показывает.
 * Команды (pause/resume/reset) идут обратно.
 */
export class Bridge {
    private ws: WebSocket | null = null
    private unsubscribe: (() => void) | null = null
    private unsubscribeEvents: (() => void) | null = null
    private unsubscribeDeps: (() => void) | null = null
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null
    private disposed = false
    private readonly mode: 'stream' | 'requests'

    constructor(
        private readonly registry: Registry,
        private readonly depsGraph: DepsGraph,
        private readonly options: BridgeOptions,
        private readonly onCommand?: (cmd: string) => void,
        private readonly onRequest?: BridgeRequestHandler,
    ) {
        this.mode = options.mode ?? 'stream'
    }

    connect(): void {
        if (this.disposed) return
        try {
            const url = `ws://${this.options.host}:${this.options.port}`
            this.ws = new WebSocket(url)
        } catch {
            this.scheduleReconnect()
            return
        }

        this.ws.onopen = () => {
            if (this.mode === 'requests') {
                this.send({ type: 'hello' })
                return
            }

            this.sendSnapshot()
            this.sendDepsSnapshot()

            this.unsubscribe = this.registry.subscribe(() => this.sendSnapshot())
            this.unsubscribeEvents = this.registry.onEvent((event) => this.sendEvent(event))
            this.unsubscribeDeps = this.depsGraph.subscribe(() => this.sendDepsSnapshot())
        }

        this.ws.onmessage = (e) => {
            try {
                const msg = JSON.parse(String(e.data)) as BridgeMessage
                if (msg.type === 'command' && typeof msg.payload === 'string') {
                    this.onCommand?.(msg.payload)
                } else if (msg.type === 'request' && typeof msg.id === 'string') {
                    void this.handleRequest(msg.id, msg.payload)
                }
            } catch { /* ignore malformed */ }
        }

        this.ws.onclose = () => {
            this.cleanup()
            this.scheduleReconnect()
        }

        this.ws.onerror = () => {
            this.ws?.close()
        }
    }

    dispose(): void {
        this.disposed = true
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
        this.cleanup()
        this.ws?.close()
        this.ws = null
    }

    private async handleRequest(id: string, payload: unknown): Promise<void> {
        const { method, params } = (payload ?? {}) as { method?: string, params?: unknown }
        try {
            if (!this.onRequest) throw new Error('requests are not supported')
            const result = await this.onRequest(String(method), params)
            this.send({ type: 'response', id, payload: { ok: true, result } })
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            this.send({ type: 'response', id, payload: { ok: false, error: message } })
        }
    }

    private send(msg: BridgeMessage): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg))
        }
    }

    private sendSnapshot(): void {
        const snap = this.registry.snapshot()
        this.send({
            type: 'snapshot',
            payload: {
                records: snap.records.map(r => ({
                    uid: r.uid,
                    name: r.name,
                    file: r.file,
                    renderCount: r.renderCount,
                    updateCount: r.updateCount,
                    totalDuration: r.totalDuration,
                    maxDuration: r.maxDuration,
                    lastDuration: r.lastDuration,
                    lastReasons: r.lastReasons,
                    lastPropChanges: r.lastPropChanges,
                })),
                paused: this.registry.isPaused(),
            },
        })
    }

    private sendEvent(event: RenderEvent): void {
        this.send({ type: 'event', payload: event })
    }

    private sendDepsSnapshot(): void {
        this.send({ type: 'deps', payload: this.depsGraph.snapshot() })
    }

    private cleanup(): void {
        this.unsubscribe?.()
        this.unsubscribeEvents?.()
        this.unsubscribeDeps?.()
        this.unsubscribe = null
        this.unsubscribeEvents = null
        this.unsubscribeDeps = null
    }

    private scheduleReconnect(): void {
        if (this.disposed || this.reconnectTimer) return
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null
            this.connect()
        }, 3000)
    }
}
