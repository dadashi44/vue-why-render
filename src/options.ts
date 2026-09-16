import type { NameFilter, ResolvedOptions, VueWhyRenderOptions } from './types'

export type DetectedEnv = 'dev' | 'prod' | 'unknown'

/**
 * Режим сборки определяем только через globalThis и намеренно НЕ пишем
 * process.env.NODE_ENV в открытую.
 *
 * Голая ссылка на process заставляет @rollup/plugin-commonjs считать наш
 * ESM-файл смешанным CommonJS, после чего его переписывание ломает код —
 * прод-сборка Nuxt падала с синтаксической ошибкой внутри нашего бандла.
 *
 * Цена решения: в браузерном бандле process обычно недоступен, поэтому там
 * честный ответ «unknown». Поэтому сканер по умолчанию ВКЛЮЧЁН везде, кроме
 * явно опознанного прода, а гасить его в проде — задача вызывающего кода
 * (в Nuxt это `if (!import.meta.dev) return`, см. README).
 */
export function detectEnv(): DetectedEnv {
    const runtime = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    const mode = runtime?.env?.NODE_ENV
    if (typeof mode === 'string') return mode === 'production' ? 'prod' : 'dev'
    return 'unknown'
}

export function isDev(): boolean {
    return detectEnv() !== 'prod'
}

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

    resolved.enabled = options.enabled ?? isDev()
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
