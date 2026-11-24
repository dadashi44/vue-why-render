import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import pkg from '../package.json' with { type: 'json' }
import type { Tools } from './tools.js'

export interface ServerConfig {
    port: number
    host: string
    allowOrigins: string[]
    timeoutMs: number
}

const FLAGS = ['--port', '--host', '--allow-origin']

function parsePort(value: string, source: string): number {
    const port = Number(value)
    if (value.trim() === '' || !Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`Invalid port "${value}" (from ${source}). Expected an integer 1–65535.`)
    }
    return port
}

export function parseConfig(argv: string[], env: Record<string, string | undefined>): ServerConfig {
    let port = env.VWR_MCP_PORT ? parsePort(env.VWR_MCP_PORT, 'VWR_MCP_PORT') : 7711
    let host = env.VWR_MCP_HOST || 'localhost'
    const allowOrigins = (env.VWR_MCP_ALLOW_ORIGIN ?? '')
        .split(',').map(s => s.trim()).filter(Boolean)

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]
        if (!FLAGS.includes(arg)) {
            throw new Error(`Unknown argument "${arg}". Supported flags: ${FLAGS.join(', ')}.`)
        }
        const next = argv[++i]
        if (next === undefined) throw new Error(`Flag ${arg} needs a value.`)
        if (arg === '--port') port = parsePort(next, '--port')
        else if (arg === '--host') host = next
        else allowOrigins.push(next)
    }
    return { port, host, allowOrigins, timeoutMs: 5000 }
}

type Result = { content: { type: 'text', text: string }[], isError?: true }

async function run(fn: () => Promise<string>): Promise<Result> {
    try {
        return { content: [{ type: 'text', text: await fn() }] }
    } catch (err) {
        const text = err instanceof Error ? err.message : String(err)
        return { content: [{ type: 'text', text }], isError: true }
    }
}

export function createServer(tools: Tools): McpServer {
    const server = new McpServer({ name: 'vue-why-render', version: pkg.version })
    const limit = z.number().int().min(1).max(100).optional()
        .describe('Maximum number of components to return (1-100).')

    server.registerTool('status', {
        description: 'Show whether a Vue app is connected, which page and Vue version it runs. Call this first to check the connection.',
    }, () => run(() => tools.status()))

    server.registerTool('report', {
        description: 'Get the render report of the running app: which components re-render, how often and why. Call it after reproducing a slow or noisy interaction.',
        inputSchema: {
            limit,
            component: z.string().optional().describe('Only show components with this name.'),
        },
    }, a => run(() => tools.report(a)))

    server.registerTool('component', {
        description: 'Get detailed render history and reasons for a single component by name. Call it to dig into one suspicious component from the report.',
        inputSchema: { name: z.string().describe('Component name.') },
    }, a => run(() => tools.component(a)))

    server.registerTool('reset', {
        description: 'Clear the render counters in the running app. Call it before reproducing an interaction so the next report only covers it.',
    }, () => run(() => tools.reset()))

    server.registerTool('baseline', {
        description: 'Save the current report as a baseline for a later diff, then reset the render counters so the diff only covers what happens afterwards. Call it before making a change or reproducing an interaction.',
    }, () => run(() => tools.baseline()))

    server.registerTool('diff', {
        description: 'Compare the current report with the saved baseline and show what changed. Call it after `baseline` and the interaction or code change.',
        inputSchema: { limit },
    }, a => run(() => tools.diff(a)))

    return server
}
