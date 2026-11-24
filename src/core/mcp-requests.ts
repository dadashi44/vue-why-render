import { version as vueVersion } from 'vue'
import type { PropChange, RenderReason, ResolvedOptions } from '../types'
import { VERSION } from '../version'
import type { BridgeRequestHandler } from './bridge'
import type { Hint } from './hints'
import { hintsForRecord } from './hints'
import type { Report } from './report'
import type { Scanner } from './scanner'

export interface AppInfo {
    url?: string
    title?: string
    vue: string
    version: string
    paused: boolean
}

export interface ComponentInstanceInfo {
    uid: number
    file?: string
    renderCount: number
    updateCount: number
    totalDuration: number
    maxDuration: number
    lastReasons: RenderReason[]
    lastPropChanges: PropChange[]
    hints: Hint[]
}

/** Сколько похожих имён отдавать, если точного совпадения нет. */
const MAX_KNOWN = 10

/**
 * Обработчик запросов MCP-сервера, живущий в браузере.
 *
 * Сервер спрашивает — страница отвечает данными из реестра. Мутирующие
 * методы (`reset`/`pause`/`resume`) повторяют команды моста VS Code.
 */
export function createMcpRequestHandler(
    scanner: Scanner,
    options: ResolvedOptions,
    getReport: () => Report,
): BridgeRequestHandler {
    const registry = scanner.registry

    return (method, params) => {
        switch (method) {
            case 'info': {
                const info: AppInfo = {
                    vue: vueVersion,
                    version: VERSION,
                    paused: registry.isPaused(),
                }
                if (typeof location !== 'undefined') info.url = location.href
                if (typeof document !== 'undefined') info.title = document.title
                return info
            }
            case 'report':
                return getReport()
            case 'component': {
                const name = String((params as { name?: unknown } | null)?.name ?? '')
                const records = registry.snapshot().records
                const instances: ComponentInstanceInfo[] = records
                    .filter(r => r.name === name)
                    .map(r => ({
                        uid: r.uid,
                        file: r.file,
                        renderCount: r.renderCount,
                        updateCount: r.updateCount,
                        totalDuration: r.totalDuration,
                        maxDuration: r.maxDuration,
                        lastReasons: r.lastReasons,
                        lastPropChanges: r.lastPropChanges,
                        hints: hintsForRecord(r, options),
                    }))
                if (instances.length > 0) return { name, instances }
                const needle = name.toLowerCase()
                const known = [...new Set(records.map(r => r.name))]
                    .filter(n => n.toLowerCase().includes(needle))
                    .slice(0, MAX_KNOWN)
                return { name, instances: [], known }
            }
            case 'reset':
                registry.reset()
                return { ok: true }
            case 'pause':
                registry.setPaused(true)
                return { ok: true }
            case 'resume':
                registry.setPaused(false)
                return { ok: true }
            default:
                throw new Error(`Unknown method: ${method}`)
        }
    }
}
