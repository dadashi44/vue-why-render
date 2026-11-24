import { formatReportMarkdown } from '../../../src/core/markdown'
import { diffReports, formatDiff } from '../../../src/core/diff'
import type { Report } from '../../../src/core/report'
import { getMessages } from '../../../src/i18n'
import { formatDuration, formatHint, formatPropChange, formatReason } from '../../../src/panel/format'
import { NOT_CONNECTED, PageError, portInUseMessage } from './connection.js'
import type { AppConnection, AppInfo } from './connection.js'
import { untrusted } from './untrusted.js'

export type AppLink = Pick<AppConnection, 'status' | 'connected' | 'request' | 'ensureListening' | 'clientCount' | 'lastRejectedOrigin'> & { port: number }

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

export function createTools(app: AppLink): Tools {
    let baseline: Report | null = null
    const t = getMessages('en')

    // Failures are thrown (the server maps them to isError). Text that came from the page stays inside the untrusted block.
    async function ask<T>(method: string, params?: unknown): Promise<T> {
        try {
            return await app.request<T>(method, params)
        } catch (err) {
            if (err instanceof PageError) throw new Error(untrusted(err.message))
            throw err
        }
    }

    return {
        status: async () => {
            if (await app.ensureListening() === 'port-in-use') throw new Error(portInUseMessage(app.port))
            if (!app.connected) {
                const lines = [NOT_CONNECTED]
                if (app.lastRejectedOrigin) {
                    lines.push(`Last rejected connection from ${untrusted(app.lastRejectedOrigin)}. If this is your dev server, allow it with --allow-origin <host> or VWR_MCP_ALLOW_ORIGIN.`)
                }
                throw new Error(lines.join('\n'))
            }
            const info = await ask<AppInfo>('info')
            const fields = [
                `title: ${info.title ?? ''}`,
                `url: ${info.url ?? ''}`,
                `vue: ${info.vue ?? 'unknown'}`,
                `vue-why-render: ${info.version ?? 'unknown'}`,
            ]
            const tabs = app.clientCount > 1 ? `\n${app.clientCount} tabs connected; using the most recent.` : ''
            return `Connected. paused: ${info.paused === true ? 'yes' : 'no'}${tabs}\n${untrusted(fields.join('\n'))}`
        },

        report: async ({ limit, component }) => {
            const report = await ask<Report>('report')
            if (component) {
                const needle = component.toLowerCase()
                report.components = report.components.filter(c => c.name.toLowerCase().includes(needle))
            }
            return untrusted(formatReportMarkdown(report, { limit: limit ?? 20 }))
        },

        component: async ({ name }) => {
            const answer = await ask<ComponentAnswer>('component', { name })
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
        },

        reset: async () => {
            await ask('reset')
            return 'Counters reset. Interact with the page, then call `report`.'
        },

        baseline: async () => {
            baseline = await ask<Report>('report')
            // Counters accumulate across HMR; zero them so diff compares only what happens after the baseline.
            await ask('reset')
            return `Baseline saved: ${baseline.totals.renders} renders across ${baseline.components.length} components. Counters reset — make the change, reproduce the scenario, then call \`diff\`.`
        },

        diff: async ({ limit }) => {
            if (!baseline) return 'No baseline yet. Call `baseline` before the change.'
            const current = await ask<Report>('report')
            return untrusted(formatDiff(diffReports(baseline, current), limit ?? 20).join('\n'))
        },
    }
}
