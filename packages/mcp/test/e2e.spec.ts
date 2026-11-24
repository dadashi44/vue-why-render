import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawn, execFileSync, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'
import { REPORT_FORMAT } from '../../../src/core/report'

const root = fileURLToPath(new URL('..', import.meta.url))

function freePort(): Promise<number> {
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

const report = {
    meta: {
        format: REPORT_FORMAT,
        package: 'vue-why-render',
        vue: '3.5.0',
        createdAt: 2000,
        startedAt: 1000,
        durationMs: 1000,
        options: {
            includeMounts: false, trackReasons: true, trackProps: true, minDuration: 0,
            hotThreshold: 5, maxEvents: 100, include: [], exclude: [],
        },
    },
    totals: { renders: 3, components: 1, rendersPerSecond: 3 },
    components: [{
        key: 'ProductCard', name: 'ProductCard', instances: 1, renderCount: 3, updateCount: 3,
        totalDuration: 3, maxDuration: 1, reasons: [], propChanges: [], hints: [],
    }],
    events: [],
}

let child: ChildProcessWithoutNullStreams
let ws: WebSocket
const lines: string[] = []
const waiters = new Map<number, (msg: any) => void>()
let buffer = ''

function rpc(id: number, method: string, params: unknown): Promise<any> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`no answer to ${method}`)), 10000)
        waiters.set(id, (msg) => { clearTimeout(timer); resolve(msg) })
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    })
}

beforeAll(async () => {
    execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'pipe' })
    const port = await freePort()
    child = spawn('node', ['dist/cli.js'], {
        cwd: root,
        env: { ...process.env, VWR_MCP_PORT: String(port) },
    })
    child.stdout.on('data', (chunk) => {
        buffer += String(chunk)
        let i
        while ((i = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, i)
            buffer = buffer.slice(i + 1)
            if (!line) continue
            lines.push(line)
            try {
                const msg = JSON.parse(line)
                waiters.get(msg.id)?.(msg)
            } catch { /* recorded in lines, asserted below */ }
        }
    })

    // The server is listening once the port accepts the app.
    const end = Date.now() + 10000
    for (;;) {
        ws = new WebSocket(`ws://localhost:${port}`, { headers: { Origin: 'http://localhost:5173' } })
        ws.on('error', () => {})
        const opened = await new Promise<boolean>(resolve => {
            ws.once('open', () => resolve(true))
            ws.once('close', () => resolve(false))
        })
        if (opened) break
        if (Date.now() > end) throw new Error('server did not start')
        await sleep(100)
    }
    ws.on('message', (raw) => {
        const msg = JSON.parse(String(raw))
        if (msg.type !== 'request') return
        const result = msg.payload.method === 'info'
            ? { title: 'Demo', url: 'http://localhost:5173/', vue: '3.5.0', version: '0.8.0', paused: false }
            : report
        ws.send(JSON.stringify({ type: 'response', id: msg.id, payload: { ok: true, result } }))
    })
    ws.send(JSON.stringify({ type: 'hello' }))
    await sleep(100)
}, 60000)

afterAll(() => {
    ws?.terminate()
    child?.kill()
})

describe('stdio server end to end', () => {
    it('serves status and report from a connected app', async () => {
        const init = await rpc(1, 'initialize', {
            protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' },
        })
        expect(init.result.serverInfo.name).toBe('vue-why-render')
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')

        const status = await rpc(2, 'tools/call', { name: 'status', arguments: {} })
        const statusText = status.result.content[0].text
        expect(statusText).toContain('Connected.')
        expect(statusText).toContain('Demo')

        const rep = await rpc(3, 'tools/call', { name: 'report', arguments: {} })
        expect(rep.result.content[0].text).toContain('<page-data>')
        expect(rep.result.content[0].text).toContain('ProductCard')
    }, 30000)

    it('writes only JSON-RPC to stdout', () => {
        expect(lines.length).toBeGreaterThan(0)
        for (const line of lines) {
            expect(() => JSON.parse(line)).not.toThrow()
            expect(JSON.parse(line).jsonrpc).toBe('2.0')
        }
    })
})
