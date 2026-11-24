import { formatReportMarkdown } from '../../../src/core/markdown'
import { diffReports, formatDiff } from '../../../src/core/diff'
import type { Report } from '../../../src/core/report'
import { getMessages } from '../../../src/i18n'
import { formatDuration, formatHint, formatPropChange, formatReason } from '../../../src/panel/format'
import type { AppConnection, AppInfo } from './connection.js'
import { untrusted } from './untrusted.js'

export type AppLink = Pick<AppConnection, 'status' | 'connected' | 'request'> & { port: number }

type Instance = {
    uid: number
    file?: string
    renderCount: number
    updateCount: number
    totalDuration: number
    maxDuration: number
    lastReasons: Parameters<typeof formatReason>[0][]
    lastPropChanges: Parameters<typeof formatPropChange>[0][]
    hints: Parameters<typeof formatHint>[0][]
}

interface ComponentAnswer {
    name: string
    instances: Instance[]
    known?: string[]
}

export interface Tools {
    status(): Promise<string>
    report(a: { limit?: number, component?: string }): Promise<string>
    component(a: { name: string }): Promise<string>
    reset(): Promise<string>
    baseline(): Promise<string>
    diff(a: { limit?: number }): Promise<string>
}

const NOT_CONNECTED =
    'No app connected. Enable `mcp: true` in the vue-why-render plugin (Nuxt: `whyRender: { mcp: true }`) and open the page in dev mode.'

function message(err: unknown): string {
    return err instanceof Error ? err.message : String(err)
}

export function createTools(app: AppLink): Tools {
    let baseline: Report | null = null
    const t = getMessages('en')

    async function guarded(run: () => Promise<string>): Promise<string> {
        try {
            return await run()
        } catch (err) {
            return message(err)
        }
    }

    return {
        status: () => guarded(async () => {
            if (app.status === 'port-in-use') {
                return `Port ${app.port} is used by another vue-why-render-mcp process (another agent session?). Close it, or set another port: VWR_MCP_PORT on the server and \`mcp: { port }\` in the app.`
            }
            if (!app.connected) return NOT_CONNECTED
            const info = await app.request<AppInfo>('info')
            const fields = [
                `title: ${info.title ?? ''}`,
                `url: ${info.url ?? ''}`,
                `vue: ${String(info.vue)}`,
                `vue-why-render: ${String(info.version)}`,
            ]
            return `Connected. paused: ${info.paused === true ? 'yes' : 'no'}\n${untrusted(fields.join('\n'))}`
        }),

        report: ({ limit, component }) => guarded(async () => {
            const report = await app.request<Report>('report')
            if (component) {
                const needle = component.toLowerCase()
                report.components = report.components.filter(c => c.name.toLowerCase().includes(needle))
            }
            return untrusted(formatReportMarkdown(report, { limit: limit ?? 20 }))
        }),

        component: ({ name }) => guarded(async () => {
            const answer = await app.request<ComponentAnswer>('component', { name })
            if (!answer.instances.length) {
                const lines = [`Component "${name}" not found.`]
                lines.push(answer.known?.length ? `Similar: ${answer.known.join(', ')}` : 'No similar names.')
                return untrusted(lines.join('\n'))
            }
            const lines: string[] = []
            for (const item of answer.instances) {
                lines.push(`${answer.name} uid ${item.uid}${item.file ? ` (${item.file})` : ''}`)
                lines.push(`  renders: ${item.renderCount} (updates: ${item.updateCount})`)
                lines.push(`  time: total ${formatDuration(item.totalDuration)}, max ${formatDuration(item.maxDuration)}`)
                for (const reason of item.lastReasons) lines.push(`  reason: ${formatReason(reason, t)}`)
                for (const change of item.lastPropChanges) lines.push(`  prop: ${formatPropChange(change, t)}`)
                for (const hint of item.hints) lines.push(`  hint: ${formatHint(hint, t)}`)
            }
            return untrusted(lines.join('\n'))
        }),

        reset: () => guarded(async () => {
            await app.request('reset')
            return 'Counters reset. Interact with the page, then call `report`.'
        }),

        baseline: () => guarded(async () => {
            baseline = await app.request<Report>('report')
            return `Baseline saved: ${baseline.totals.renders} renders across ${baseline.components.length} components. Make the change, reproduce the scenario, then call \`diff\`.`
        }),

        diff: ({ limit }) => guarded(async () => {
            if (!baseline) return 'No baseline yet. Call `baseline` before the change.'
            const current = await app.request<Report>('report')
            return untrusted(formatDiff(diffReports(baseline, current), limit ?? 20).join('\n'))
        }),
    }
}
