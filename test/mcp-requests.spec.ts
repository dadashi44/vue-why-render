import { afterEach, describe, expect, it, vi } from 'vitest'
import type { App } from 'vue'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { scan } from '../src/index'
import type { ScanHandle } from '../src/index'
import { createMcpRequestHandler } from '../src/core/mcp-requests'
import { REPORT_FORMAT } from '../src/core/report'
import type { VueWhyRenderOptions } from '../src/types'
import { FakeWebSocket } from './fake-websocket'

let app: App | null = null
let handle: ScanHandle | null = null
let host: HTMLElement | null = null

function start(root: ReturnType<typeof defineComponent>, options: VueWhyRenderOptions = {}) {
    host = document.createElement('div')
    document.body.appendChild(host)
    app = createApp(root)
    handle = scan(app, { panel: false, overlay: false, ...options })!
    app.mount(host)
    return handle
}

function handlerFor(h: ScanHandle) {
    return createMcpRequestHandler(h.scanner, h.scanner.options, () => h.getReport())
}

afterEach(() => {
    handle?.stop()
    app?.unmount()
    host?.remove()
    app = null
    handle = null
    host = null
    vi.unstubAllGlobals()
    FakeWebSocket.reset()
})

function twoCards(name = 'Card') {
    const n = ref(0)
    const Card = defineComponent({
        name,
        props: { n: Number },
        render() {
            return h('i', String(this.n))
        },
    })
    const Root = defineComponent({
        render() {
            return h('div', [h(Card, { n: n.value }), h(Card, { n: n.value })])
        },
    })
    return { Root, n }
}

describe('mcp request handler', () => {
    it('info returns versions and pause state', async () => {
        const { Root } = twoCards()
        const hd = start(Root)
        const call = handlerFor(hd)
        const info = await call('info', {}) as any
        expect(info.vue).toMatch(/^\d/)
        expect(info.version).toBeTruthy()
        expect(info.paused).toBe(false)
        await call('pause', {})
        expect((await call('info', {}) as any).paused).toBe(true)
        await call('resume', {})
        expect((await call('info', {}) as any).paused).toBe(false)
    })

    it('report returns the same shape as getReport', async () => {
        const hd = start(twoCards().Root)
        const report = await handlerFor(hd)('report', {}) as any
        expect(report.meta.format).toBe(REPORT_FORMAT)
        expect(Array.isArray(report.components)).toBe(true)
    })

    it('component returns every instance with hints', async () => {
        const { Root, n } = twoCards()
        const hd = start(Root)
        n.value++
        await nextTick()
        const res = await handlerFor(hd)('component', { name: 'Card' }) as any
        expect(res.name).toBe('Card')
        expect(res.instances.length).toBe(2)
        for (const inst of res.instances) {
            expect(typeof inst.uid).toBe('number')
            expect(Array.isArray(inst.lastReasons)).toBe(true)
            expect(Array.isArray(inst.hints)).toBe(true)
        }
    })

    it('unknown component lists similar names', async () => {
        const hd = start(twoCards('ProductCard').Root)
        const res = await handlerFor(hd)('component', { name: 'card' }) as any
        expect(res.instances).toEqual([])
        expect(res.known).toContain('ProductCard')
    })

    it('reset clears counters', async () => {
        const { Root, n } = twoCards()
        const hd = start(Root)
        n.value++
        await nextTick()
        const call = handlerFor(hd)
        expect(await call('reset', {})).toEqual({ ok: true })
        expect((await call('report', {}) as any).totals.renders).toBe(0)
    })

    it('unknown method throws', () => {
        const hd = start(twoCards().Root)
        expect(() => handlerFor(hd)('nope', {})).toThrow('Unknown method: nope')
    })
})

describe('scan mcp option', () => {
    const urls = () => FakeWebSocket.instances.map(i => i.url)

    it('scan with mcp:true opens a bridge on 7711', () => {
        vi.stubGlobal('WebSocket', FakeWebSocket)
        start(twoCards().Root, { mcp: true })
        expect(urls()).toEqual(['ws://localhost:7711'])
    })

    it('opens both bridges with vscode and mcp', () => {
        vi.stubGlobal('WebSocket', FakeWebSocket)
        start(twoCards().Root, { vscode: true, mcp: true })
        expect(urls().sort()).toEqual(['ws://localhost:7710', 'ws://localhost:7711'])
    })

    it('no 7711 socket without mcp', () => {
        vi.stubGlobal('WebSocket', FakeWebSocket)
        start(twoCards().Root, { vscode: true })
        expect(urls()).toEqual(['ws://localhost:7710'])
    })
})
