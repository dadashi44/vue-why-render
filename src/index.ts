import type { App, Plugin } from 'vue'
import type { BudgetViolation, ComponentRecord, RenderEvent, VueWhyRenderOptions } from './types'
import { resolveOptions } from './options'
import { Scanner } from './core/scanner'
import { createReport, downloadReport } from './core/report'
import type { Report } from './core/report'
import { printReport as printReportTo } from './core/console'
import type { PrintOptions } from './core/console'
import { mountPanel } from './panel/mount'
import { setupDevtools } from './devtools/plugin'
import { bindHotkey } from './utils/hotkey'
import { VERSION } from './version'

export type {
    BudgetKind,
    BudgetViolation,
    ComponentRecord,
    NameFilter,
    PanelTheme,
    PropChange,
    ReasonSource,
    RenderBudget,
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
export type { MarkdownOptions } from './core/markdown'
export { formatReportMarkdown } from './core/markdown'
export type { PrintOptions, PrintRow } from './core/console'
export { reportRows } from './core/console'
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
    /** Снять отчёт и напечатать таблицей в консоль. */
    printReport: (options?: PrintOptions) => void
    /** Нарушения бюджетов за сессию. */
    getViolations: () => BudgetViolation[]
}

/**
 * То, что сканер кладёт в `window.__VUE_WHY_RENDER__`. Нужно там, где модули
 * страницы недоступны: тест в Playwright видит только window, а консоль
 * браузера не может импортировать пакет.
 */
export interface WindowHandle {
    version: string
    getReport: () => Report
    getViolations: () => BudgetViolation[]
    printReport: (options?: PrintOptions) => void
    pause: () => void
    resume: () => void
    reset: () => void
}

declare global {
    interface Window {
        __VUE_WHY_RENDER__?: WindowHandle
    }
}

/**
 * Повесить handle на window. Сканер и так живёт только в деве — пакет
 * в прод не попадает, — так что глобал не утекает туда, где не нужен.
 */
function exposeOnWindow(handle: ScanHandle): () => void {
    if (typeof window === 'undefined') return () => {}
    const exposed: WindowHandle = {
        version: VERSION,
        getReport: () => handle.getReport(),
        getViolations: () => handle.getViolations(),
        printReport: options => handle.printReport(options),
        pause: () => handle.pause(),
        resume: () => handle.resume(),
        reset: () => handle.reset(),
    }
    window.__VUE_WHY_RENDER__ = exposed
    return () => {
        // Второй сканер мог успеть повесить свой — чужой не трогаем.
        if (window.__VUE_WHY_RENDER__ === exposed) delete window.__VUE_WHY_RENDER__
    }
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
    // Пауза живёт в реестре, а не в панели: клавиша работает и с выключенной панелью.
    const unbindHotkey = resolved.pauseHotkey
        ? bindHotkey(resolved.pauseHotkey, () => scanner.registry.setPaused(!scanner.registry.isPaused()))
        : null

    const handle: ScanHandle = {
        scanner,
        stop() {
            unmountPanel?.()
            stopDevtools?.()
            unbindHotkey?.()
            unexpose()
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
        printReport(printOptions) {
            printReportTo(handle.getReport(), printOptions)
        },
        getViolations() {
            return scanner.registry.getViolations()
        },
    }

    const unexpose = exposeOnWindow(handle)

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

/**
 * Отчёт по текущей сессии таблицей в консоль. Без аргумента печатает живую
 * сессию, с аргументом — любой отчёт, например разобранный `parseReport()`.
 */
export function printReport(report?: Report | null, options?: PrintOptions): void {
    const target = report ?? activeHandle?.getReport()
    if (!target) {
        console.warn('[vue-why-render] printReport: the scanner is not running and no report was given')
        return
    }
    printReportTo(target, options)
}

export default VueWhyRender
