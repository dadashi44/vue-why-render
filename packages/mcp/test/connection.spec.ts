import { afterEach, describe, expect, it } from 'vitest'
import { createServer } from 'node:net'
import WebSocket from 'ws'
import { AppConnection } from '../src/connection.js'

const NOT_CONNECTED =
    'No app connected. Enable `mcp: true` in the vue-why-render plugin (Nuxt: `whyRender: { mcp: true }`) and open the page in dev mode.'

async function freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const s = createServer()
        s.listen(0, 'localhost', () => {
            const p = (s.address() as { port: number }).port
            s.close(() => resolve(p))
        })
        s.on('error', reject)
    })
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
async function until(fn: () => boolean, ms = 2000) {
    const end = Date.now() + ms
    while (!fn()) {
        if (Date.now() > end) throw new Error('until timeout')
        await sleep(10)
    }
}

const conns: AppConnection[] = []
const clients: WebSocket[] = []

async function setup(timeoutMs = 2000) {
    const port = await freePort()
    const conn = new AppConnection({ port, host: 'localhost', allowOrigins: [], timeoutMs })
    conns.push(conn)
    await conn.start()
    return { conn, port }
}

async function client(port: number, origin = 'http://localhost:5173') {
    const ws = new WebSocket(`ws://localhost:${port}`, { headers: { Origin: origin } })
    clients.push(ws)
    ws.on('error', () => {})
    await new Promise<void>(resolve => {
        ws.once('open', () => resolve())
        ws.once('close', () => resolve())
    })
    return ws
}

afterEach(async () => {
    clients.splice(0).forEach(c => c.terminate())
    await Promise.all(conns.splice(0).map(c => c.close()))
})

describe('AppConnection', () => {
    it('answers request from a connected app', async () => {
        const { conn, port } = await setup()
        const ws = await client(port)
        ws.send(JSON.stringify({ type: 'hello' }))
        ws.on('message', raw => {
            const msg = JSON.parse(String(raw))
            if (msg.type === 'request') {
                ws.send(JSON.stringify({ type: 'response', id: msg.id, payload: { ok: true, result: 1 } }))
            }
        })
        await until(() => conn.connected)
        await expect(conn.request('info')).resolves.toBe(1)
    })

    it('rejects foreign origin', async () => {
        const { conn, port } = await setup()
        const ws = await client(port, 'https://evil.com')
        await sleep(50)
        expect(ws.readyState).not.toBe(WebSocket.OPEN)
        expect(conn.connected).toBe(false)
    })

    it('not connected error', async () => {
        const { conn } = await setup()
        await expect(conn.request('info')).rejects.toThrow(NOT_CONNECTED)
    })

    it('connects after server start', async () => {
        const port = await freePort()
        const conn = new AppConnection({ port, host: 'localhost', allowOrigins: [], timeoutMs: 1000 })
        conns.push(conn)
        await conn.start()
        await sleep(50)
        await client(port)
        await until(() => conn.connected)
        expect(conn.connected).toBe(true)
        expect(conn.port).toBe(port)
    })

    it('timeout', async () => {
        const { conn, port } = await setup(100)
        await client(port)
        await until(() => conn.connected)
        await expect(conn.request('info')).rejects.toThrow(/timed out/)
    })

    it('socket close rejects pending requests', async () => {
        const { conn, port } = await setup()
        const ws = await client(port)
        await until(() => conn.connected)
        const p = conn.request('info')
        const assertion = expect(p).rejects.toThrow()
        await sleep(20)
        ws.close()
        await assertion
        await until(() => !conn.connected)
    })

    it('port in use', async () => {
        const { conn, port } = await setup()
        const second = new AppConnection({ port, host: 'localhost', allowOrigins: [], timeoutMs: 100 })
        conns.push(second)
        expect(await second.start()).toBe('port-in-use')
        expect(second.status).toBe('port-in-use')
        await expect(second.request('info')).rejects.toThrow(
            `Port ${port} is used by another vue-why-render-mcp process`,
        )
    })

    it('ok:false becomes Error', async () => {
        const { conn, port } = await setup()
        const ws = await client(port)
        ws.on('message', raw => {
            const msg = JSON.parse(String(raw))
            ws.send(JSON.stringify({ type: 'response', id: msg.id, payload: { ok: false, error: 'boom' } }))
        })
        await until(() => conn.connected)
        await expect(conn.request('report')).rejects.toThrow('boom')
    })

    it('ignores a response with a stale id and replaces the old connection', async () => {
        const { conn, port } = await setup()
        const first = await client(port)
        await until(() => conn.connected)
        const second = await client(port)
        await sleep(30)
        expect(first.readyState).not.toBe(WebSocket.OPEN)
        second.on('message', raw => {
            const msg = JSON.parse(String(raw))
            second.send(JSON.stringify({ type: 'response', id: 'stale', payload: { ok: true, result: 0 } }))
            second.send(JSON.stringify({ type: 'response', id: msg.id, payload: { ok: true, result: 'ok' } }))
        })
        await expect(conn.request('info')).resolves.toBe('ok')
    })
})
