import type { App, Plugin } from 'vue'
import type { ComponentRecord, RenderEvent, VueWhyRenderOptions } from './types'
import { resolveOptions } from './options'
import { Scanner } from './core/scanner'
import { createReport, downloadReport } from './core/report'
import type { Report } from './core/report'
import { mountPanel } from './panel/mount'
import { setupDevtools } from './devtools/plugin'

export type {
    ComponentRecord,
    NameFilter,
    PropChange,
    ReasonSource,
    RenderEvent,
    RenderPhase,
    RenderReason,
    ResolvedOptions,
    VueWhyRenderOptions,
} from './types'
export type { Locale, Messages } from './i18n'
export { messages } from './i18n'
export type { RegistrySnapshot, TreeNode } from './core/registry'
export type { Report, ReportComponent, ReportMeta, ReportOptions } from './core/report'
export {
    componentKey,
    createReport,
    downloadReport,
    parseReport,
    reasonKey,
    REPORT_FORMAT,
    ReportParseError,
    serializeReport,
} from './core/report'
export type { Hint, HintCode, HintInput } from './core/hints'
export { hintsFor, hintsForRecord } from './core/hints'
export type { ComponentDiff, DiffStatus, ReportDiff } from './core/diff'
export { diffReports, formatDiff } from './core/diff'
export { VERSION } from './version'
export { Registry } from './core/registry'
export { Scanner } from './core/scanner'
export { describeTrigger, diffProps, formatValue } from './core/reason'
export { resolveOptions, shouldTrack } from './options'

export interface ScanHandle {
    scanner: Scanner
    /** Остановить сбор данных и убрать панель с оверлеем. */
    stop: () => void
    pause: () => void
    resume: () => void
    reset: () => void
    getStats: () => ComponentRecord[]
    getEvents: () => RenderEvent[]
    /** Снимок всей сессии одним сериализуемым объектом. */
    getReport: () => Report
    /** Снять отчёт и сохранить файлом. */
    saveReport: (filename?: string) => void
}

let activeHandle: ScanHandle | null = null
/**
 * Навесить сканер на приложение вручную.
 * Возвращает null, если сканер выключен опцией enabled.
 */
export function scan(app: App, options: VueWhyRenderOptions = {}): ScanHandle | null {
    const resolved = resolveOptions(options)
    if (!resolved.enabled) return null

    const scanner = new Scanner(resolved)
    app.mixin(scanner.createMixin())

    const unmountPanel = resolved.panel ? mountPanel(scanner) : null
    const stopDevtools = resolved.devtools ? setupDevtools(app, scanner) : null

    const handle: ScanHandle = {
        scanner,
        stop() {
            unmountPanel?.()
            stopDevtools?.()
            scanner.dispose()
            if (activeHandle === handle) activeHandle = null
        },
        pause() {
            scanner.registry.setPaused(true)
        },
        resume() {
            scanner.registry.setPaused(false)
        },
        reset() {
            scanner.registry.reset()
        },
        getStats() {
            return scanner.registry.snapshot().records
        },
        getEvents() {
            return scanner.registry.getEvents()
        },
        getReport() {
            return createReport({ registry: scanner.registry, options: resolved })
        },
        saveReport(filename) {
            downloadReport(handle.getReport(), filename)
        },
    }

    activeHandle = handle
    return handle
}

export const VueWhyRender: Plugin<[VueWhyRenderOptions?]> = {
    install(app, options: VueWhyRenderOptions = {}) {
        scan(app, options)
    },
}

/** Текущий сканер, если он запущен. */
export function getScanHandle(): ScanHandle | null {
    return activeHandle
}

/** Статистика по живым компонентам — удобно дёргать из консоли. */
export function getStats(): ComponentRecord[] {
    return activeHandle?.getStats() ?? []
}

export function getEvents(): RenderEvent[] {
    return activeHandle?.getEvents() ?? []
}

export function reset(): void {
    activeHandle?.reset()
}

/** Отчёт по текущей сессии — удобно дёргать прямо из консоли. */
export function getReport(): Report | null {
    return activeHandle?.getReport() ?? null
}

export function saveReport(filename?: string): void {
    activeHandle?.saveReport(filename)
}

export default VueWhyRender
