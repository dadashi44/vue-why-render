import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Bridge, MCP_BRIDGE_DEFAULTS } from '../src/core/bridge'
import { DepsGraph } from '../src/core/deps-graph'
import { Registry } from '../src/core/registry'
import { FakeWebSocket } from './fake-websocket'

const OPTS = { port: 7710, host: 'localhost' }

function setup() {
    return { registry: new Registry(), depsGraph: new DepsGraph() }
}

function flush(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0))
}

describe('Bridge', () => {
    beforeEach(() => {
        FakeWebSocket.reset()
        vi.stubGlobal('WebSocket', FakeWebSocket)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    function connect(opts: { mode?: 'stream' | 'requests' } = {}, onCommand?: (c: string) => void, onRequest?: (m: string, p: unknown) => unknown) {
        const { registry, depsGraph } = setup()
        const bridge = new Bridge(registry, depsGraph, { ...OPTS, ...opts }, onCommand, onRequest)
        bridge.connect()
        const ws = FakeWebSocket.instances[0]
        ws.open()
        return { bridge, registry, ws }
    }

    it('MCP_BRIDGE_DEFAULTS uses port 7711', () => {
        expect(MCP_BRIDGE_DEFAULTS).toEqual({ port: 7711, host: 'localhost' })
    })

    it('stream mode sends snapshot and deps on open', () => {
        const { ws, bridge } = connect()
        const types = ws.sent.map(m => (m as { type: string }).type)
        expect(types).toContain('snapshot')
        expect(types).toContain('deps')
        bridge.dispose()
    })

    it('requests mode sends only hello on open', () => {
        const { ws, registry, bridge } = connect({ mode: 'requests' })
        expect(ws.sent).toEqual([{ type: 'hello' }])

        registry.register({ uid: 1, name: 'A', file: undefined, parentUid: null })
        registry.record({
            uid: 1, name: 'A', phase: 'update', duration: 1, fps: 60,
            timestamp: 1, reasons: [], propChanges: [],
        })
        expect(ws.sent).toEqual([{ type: 'hello' }])
        bridge.dispose()
    })

    it('answers a request through onRequest', async () => {
        const { ws, bridge } = connect({}, undefined, m => ({ m }))
        ws.sent.length = 0
        ws.receive({ type: 'request', id: 'a1', payload: { method: 'info' } })
        await flush()
        expect(ws.sent).toEqual([{ type: 'response', id: 'a1', payload: { ok: true, result: { m: 'info' } } }])
        bridge.dispose()
    })

    it('async handler result is awaited', async () => {
        const { ws, bridge } = connect({}, undefined, () => Promise.resolve(42))
        ws.sent.length = 0
        ws.receive({ type: 'request', id: 'a2', payload: { method: 'x' } })
        await flush()
        expect(ws.sent).toEqual([{ type: 'response', id: 'a2', payload: { ok: true, result: 42 } }])
        bridge.dispose()
    })

    it('handler error becomes ok:false', async () => {
        const { ws, bridge } = connect({}, undefined, () => { throw new Error('boom') })
        ws.sent.length = 0
        ws.receive({ type: 'request', id: 'a3', payload: { method: 'x' } })
        await flush()
        expect(ws.sent).toEqual([{ type: 'response', id: 'a3', payload: { ok: false, error: 'boom' } }])
        bridge.dispose()
    })

    it('request without onRequest becomes ok:false', async () => {
        const { ws, bridge } = connect()
        ws.sent.length = 0
        ws.receive({ type: 'request', id: 'a4', payload: { method: 'x' } })
        await flush()
        expect(ws.sent).toHaveLength(1)
        expect(ws.sent[0]).toMatchObject({ type: 'response', id: 'a4', payload: { ok: false } })
        bridge.dispose()
    })

    it('string commands still work', () => {
        const onCommand = vi.fn()
        const { ws, bridge } = connect({}, onCommand)
        ws.receive({ type: 'command', payload: 'reset' })
        expect(onCommand).toHaveBeenCalledWith('reset')
        bridge.dispose()
    })
})
