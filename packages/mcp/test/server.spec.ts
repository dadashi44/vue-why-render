import { describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createServer, parseConfig } from '../src/server'
import { createTools, type Tools } from '../src/tools'

function fakeTools(over: Partial<Tools> = {}): Tools {
    const ok = async () => 'ok'
    return { status: ok, report: ok, component: ok, reset: ok, baseline: ok, diff: ok, ...over }
}

async function connect(tools: Tools) {
    const [a, b] = InMemoryTransport.createLinkedPair()
    await createServer(tools).connect(a)
    const client = new Client({ name: 't', version: '0' })
    await client.connect(b)
    return client
}

describe('parseConfig', () => {
    it('defaults', () => {
        expect(parseConfig([], {})).toEqual({ port: 7711, host: 'localhost', allowOrigins: [], timeoutMs: 5000 })
    })

    it('rejects an invalid port with a clear message', () => {
        expect(() => parseConfig(['--port', 'abc'], {})).toThrow('Invalid port "abc" (from --port). Expected an integer 1–65535.')
        expect(() => parseConfig([], { VWR_MCP_PORT: 'abc' })).toThrow('Invalid port "abc" (from VWR_MCP_PORT)')
        expect(() => parseConfig(['--port', '70000'], {})).toThrow('Invalid port "70000"')
    })

    it('rejects a flag without a value and unknown flags', () => {
        expect(() => parseConfig(['--port'], {})).toThrow('Flag --port needs a value.')
        expect(() => parseConfig(['--host'], {})).toThrow('Flag --host needs a value.')
        expect(() => parseConfig(['--nope'], {})).toThrow('Unknown argument "--nope". Supported flags: --port, --host, --allow-origin.')
    })

    it('env and flags', () => {
        expect(parseConfig([], { VWR_MCP_PORT: '7799' }).port).toBe(7799)
        expect(parseConfig(['--port', '7800'], { VWR_MCP_PORT: '7799' }).port).toBe(7800)
        expect(parseConfig(['--host', 'h.test'], { VWR_MCP_HOST: 'x' }).host).toBe('h.test')
        expect(parseConfig(['--allow-origin', 'c.test'], { VWR_MCP_ALLOW_ORIGIN: 'a.test,b.test' }).allowOrigins)
            .toEqual(['a.test', 'b.test', 'c.test'])
    })
})

describe('createServer', () => {
    it('lists six tools', async () => {
        const client = await connect(fakeTools())
        const { tools } = await client.listTools()
        expect(tools.map(t => t.name).sort()).toEqual(['baseline', 'component', 'diff', 'report', 'reset', 'status'])
    })

    it('returns text content', async () => {
        const client = await connect(fakeTools())
        const res = await client.callTool({ name: 'status', arguments: {} })
        expect(res.content).toEqual([{ type: 'text', text: 'ok' }])
    })

    it('tool error is returned as isError', async () => {
        const client = await connect(fakeTools({ report: async () => { throw new Error('boom') } }))
        const res = await client.callTool({ name: 'report', arguments: {} })
        expect(res.isError).toBe(true)
        expect(res.content).toEqual([{ type: 'text', text: 'boom' }])
    })

    it('real tools report a missing app as isError with readable text', async () => {
        const tools = createTools({
            port: 7711,
            status: 'listening',
            connected: false,
            clientCount: 0,
            lastRejectedOrigin: null,
            ensureListening: async () => 'listening',
            request: (async () => { throw new Error('No app connected. x') }) as never,
        })
        const client = await connect(tools)
        for (const name of ['status', 'report', 'reset']) {
            const res = await client.callTool({ name, arguments: {} })
            expect(res.isError).toBe(true)
            expect((res.content as { text: string }[])[0].text).toContain('No app connected')
        }
    })
})
