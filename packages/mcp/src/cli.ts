import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { AppConnection } from './connection.js'
import { createServer, parseConfig } from './server.js'
import { createTools } from './tools.js'

async function main(): Promise<void> {
    const cfg = parseConfig(process.argv.slice(2), process.env)
    const conn = new AppConnection(cfg)
    const status = await conn.start()
    if (status === 'port-in-use') {
        console.error(`[vue-why-render-mcp] port ${cfg.port} is already in use (another agent session?). Continuing without the app bridge; set VWR_MCP_PORT to use another port.`)
    }
    const server = createServer(createTools(conn))
    await server.connect(new StdioServerTransport())
    // The agent closing stdin means the session is over; the WebSocket server would keep us alive.
    process.stdin.on('end', () => process.exit(0))
}

main().catch((err) => {
    console.error('[vue-why-render-mcp]', err)
    process.exit(1)
})
