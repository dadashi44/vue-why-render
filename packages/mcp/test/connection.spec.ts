import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServer } from 'node:net'
import WebSocket from 'ws'
import { AppConnection, PageError } from '../src/connection.js'

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
        const { port } = await setup()
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
        const err: unknown = await conn.request('report').catch(e => e)
        expect(err).toBeInstanceOf(PageError)
        expect((err as Error).message).toBe('boom')
    })

    it('local errors are not PageError', async () => {
        const { conn } = await setup()
        const err = await conn.request('info').catch(e => e)
        expect(err).not.toBeInstanceOf(PageError)
    })

    it('port in use recovers once the other process releases the port', async () => {
        const { conn, port } = await setup()
        const second = new AppConnection({ port, host: 'localhost', allowOrigins: [], timeoutMs: 500 })
        conns.push(second)
        expect(await second.start()).toBe('port-in-use')
        expect(await second.ensureListening()).toBe('port-in-use')
        await conn.close()
        expect(await second.ensureListening()).toBe('listening')
        expect(second.status).toBe('listening')
        await expect(second.request('info')).rejects.toThrow(NOT_CONNECTED)
    })

    it('request retries the port and then reaches the app', async () => {
        const { conn, port } = await setup()
        const second = new AppConnection({ port, host: 'localhost', allowOrigins: [], timeoutMs: 500 })
        conns.push(second)
        await second.start()
        await conn.close()
        // The request itself retries the bind; with no page yet it fails as "not connected", not "port in use".
        await expect(second.request('info')).rejects.toThrow(NOT_CONNECTED)
        expect(second.status).toBe('listening')
        const ws = await client(port)
        ws.on('message', raw => {
            const msg = JSON.parse(String(raw))
            ws.send(JSON.stringify({ type: 'response', id: msg.id, payload: { ok: true, result: 'hi' } }))
        })
        await until(() => second.connected)
        await expect(second.request('info')).resolves.toBe('hi')
    })

    it('remembers the last rejected origin and logs it', async () => {
        const { conn, port } = await setup()
        const log = vi.spyOn(console, 'error').mockImplementation(() => {})
        await client(port, 'https://evil.example')
        expect(conn.lastRejectedOrigin).toBe('https://evil.example')
        expect(log).toHaveBeenCalledTimes(1)
        expect(String(log.mock.calls[0][0])).toContain('https://evil.example')
        log.mockRestore()
    })

    it('counts open tabs and keeps the older ones', async () => {
        const { conn, port } = await setup()
        const first = await client(port)
        await until(() => conn.clientCount === 1)
        const second = await client(port)
        await until(() => conn.clientCount === 2)
        expect(first.readyState).toBe(WebSocket.OPEN)
        second.terminate()
        await until(() => conn.clientCount === 1)
        expect(conn.connected).toBe(true)
    })

    it('ignores a response with a stale id and answers through the newest connection', async () => {
        const { conn, port } = await setup()
        await client(port)
        await until(() => conn.connected)
        const second = await client(port)
        await sleep(30)
        second.on('message', raw => {
            const msg = JSON.parse(String(raw))
            second.send(JSON.stringify({ type: 'response', id: 'stale', payload: { ok: true, result: 0 } }))
            second.send(JSON.stringify({ type: 'response', id: msg.id, payload: { ok: true, result: 'ok' } }))
        })
        await expect(conn.request('info')).resolves.toBe('ok')
    })
})
