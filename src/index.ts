import type { App, Plugin } from 'vue'
import type { ComponentRecord, RenderEvent, VueWhyRenderOptions } from './types'
import { resolveOptions } from './options'
import { Scanner } from './core/scanner'
import { mountPanel } from './panel/mount'

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
export type { RegistrySnapshot, TreeNode } from './core/registry'
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

    const handle: ScanHandle = {
        scanner,
        stop() {
            unmountPanel?.()
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

export default VueWhyRender
