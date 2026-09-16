import type { NameFilter, ResolvedOptions, VueWhyRenderOptions } from './types'

export type DetectedEnv = 'dev' | 'prod' | 'unknown'

/**
 * Определяем окружение только по process.env.NODE_ENV.
 * import.meta.env специально не трогаем: сборщик пакета вшил бы туда СВОЙ
 * режим, и у потребителя вместо его дева всегда оказывался бы прод.
 * NODE_ENV же подставляет сборщик приложения — и Vite, и webpack делают это
 * в том числе для кода из node_modules.
 *
 * 'unknown' остаётся для случая, когда пакет подключили исходниками мимо
 * пребандлинга: тогда подстановки нет и режим надо задать опцией enabled.
 */
export function detectEnv(): DetectedEnv {
    try {
        // Обращение написано в лоб специально: сборщик подставляет сюда строку
        // на этапе сборки ПРИЛОЖЕНИЯ. Обернуть это в typeof process нельзя —
        // подстановка попадёт внутрь выражения, а сама проверка останется,
        // и в браузере, где process не существует, всё отвалится на ней.
        const mode = process.env.NODE_ENV
        if (typeof mode === 'string') return mode === 'production' ? 'prod' : 'dev'
    }
    catch {
        // process нет и замены не случилось — режим определить нечем.
    }
    return 'unknown'
}

export function isDev(): boolean {
    return detectEnv() === 'dev'
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
