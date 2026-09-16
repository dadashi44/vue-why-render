import type { NameFilter, ResolvedOptions, VueWhyRenderOptions } from './types'

/**
 * Режим сборки пакет не определяет вовсе, и это осознанно.
 *
 * Любое упоминание `process` в бандле — даже через `globalThis.process` —
 * заставляет @rollup/plugin-commonjs принять наш ESM-файл за смешанный
 * CommonJS и переписать его в синтаксически битый код: прод-сборка Nuxt
 * падала с `Unexpected token &&` внутри нашего же файла.
 *
 * Поэтому сканер включён по умолчанию, а гасить его в проде должен
 * вызывающий код статическим флагом сборщика (`import.meta.dev` в Nuxt,
 * `import.meta.env.DEV` в Vite) — тогда вырезается и импорт пакета. См. README.
 */

export const defaultOptions: Omit<ResolvedOptions, 'enabled'> = {
    overlay: true,
    panel: true,
    showLabels: true,
    includeMounts: false,
    trackReasons: true,
    trackProps: true,
    exclude: [],
    include: [],
    minDuration: 0,
    hotThreshold: 5,
    maxEvents: 500,
    flushInterval: 250,
    displayDuration: 600,
    openInEditorUrl: '/__open-in-editor?file={file}',
}

export function resolveOptions(options: VueWhyRenderOptions = {}): ResolvedOptions {
    const resolved = {
        ...defaultOptions,
        ...stripUndefined(options),
    } as ResolvedOptions

    resolved.enabled = options.enabled ?? true
    // Отрицательные и нечисловые значения ломают арифметику дальше по коду.
    resolved.maxEvents = Math.max(1, Math.floor(resolved.maxEvents))
    resolved.flushInterval = Math.max(0, resolved.flushInterval)
    resolved.displayDuration = Math.max(0, resolved.displayDuration)
    resolved.hotThreshold = Math.max(1, resolved.hotThreshold)
    resolved.minDuration = Math.max(0, resolved.minDuration)
    return resolved
}

function stripUndefined<T extends object>(source: T): Partial<T> {
    const result: Partial<T> = {}
    for (const key of Object.keys(source) as (keyof T)[]) {
        if (source[key] !== undefined) result[key] = source[key]
    }
    return result
}

function matches(filter: NameFilter, name: string, file?: string): boolean {
    if (typeof filter === 'function') return filter(name, file)
    if (filter instanceof RegExp) {
        // Регулярка с флагом g тащит lastIndex между вызовами и врёт через раз.
        filter.lastIndex = 0
        return filter.test(name)
    }
    return name === filter
}

/** Проходит ли компонент через include/exclude. exclude сильнее include. */
export function shouldTrack(name: string, options: ResolvedOptions, file?: string): boolean {
    if (options.exclude.some(filter => matches(filter, name, file))) return false
    if (options.include.length === 0) return true
    return options.include.some(filter => matches(filter, name, file))
}
