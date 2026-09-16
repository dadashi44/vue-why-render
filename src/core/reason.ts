import type { ComponentInternalInstance, DebuggerEvent } from 'vue'
import { isRef, toRaw } from 'vue'
import type { PropChange, ReasonSource, RenderReason } from '../types'

const MAX_PREVIEW = 48

/**
 * Короткое превью значения для UI.
 * Никогда не бросает: значение может быть прокси, геттером с побочками
 * или объектом с циклами — а мы всего лишь рисуем подпись.
 */
export function formatValue(value: unknown): string {
    try {
        return truncate(stringify(value))
    }
    catch {
        return '<unserializable>'
    }
}

function stringify(value: unknown): string {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'

    const type = typeof value
    if (type === 'string') return JSON.stringify(value)
    if (type === 'number' || type === 'boolean' || type === 'bigint') return String(value)
    if (type === 'symbol') return String(value)
    if (type === 'function') {
        const name = (value as { name?: string }).name
        return name ? `ƒ ${name}()` : 'ƒ ()'
    }

    const raw = toRaw(value as object)
    if (Array.isArray(raw)) return `Array(${raw.length})`
    if (raw instanceof Map) return `Map(${raw.size})`
    if (raw instanceof Set) return `Set(${raw.size})`
    if (raw instanceof Date) return raw.toISOString()
    if (raw instanceof RegExp) return String(raw)
    if (typeof Node !== 'undefined' && raw instanceof Node) {
        return `<${(raw as Element).tagName?.toLowerCase() || 'node'}>`
    }

    const keys = Object.keys(raw)
    if (keys.length === 0) return '{}'
    return `{ ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', …' : ''} }`
}

function truncate(text: string): string {
    return text.length > MAX_PREVIEW ? `${text.slice(0, MAX_PREVIEW - 1)}…` : text
}

/** Ключ из DebuggerEvent бывает символом вроде ITERATE_KEY. */
function normalizeKey(key: unknown): string {
    if (typeof key === 'symbol') {
        const description = key.description || String(key)
        return description.replace(/^Symbol\((.*)\)$/, '$1') || 'symbol'
    }
    if (key === undefined || key === null) return '?'
    return String(key)
}

/**
 * Ищем, под каким именем реф лежит в setupState — иначе в отчёте будет бесполезное «value».
 *
 * Читаем свойства строго через дескрипторы и пропускаем геттеры: обычное
 * перечисление вычисляло бы computed'ы чужого приложения прямо внутри
 * renderTriggered. На реальном проекте это роняло гидрацию — computed,
 * рассчитанный на более поздний момент, падал при раннем обращении.
 */
function findRefName(container: unknown, target: object): string | null {
    if (!container || typeof container !== 'object') return null

    const raw = toRaw(container as object)
    const descriptors = Object.getOwnPropertyDescriptors(raw)

    for (const key of Object.keys(descriptors)) {
        const descriptor = descriptors[key]
        // Геттер трогать нельзя: вычисление имеет побочные эффекты.
        if (!descriptor || typeof descriptor.get === 'function') continue

        const value = descriptor.value
        if (value === target) return key
        if (isRef(value) && toRaw(value as object) === target) return key
    }
    return null
}

/** setupState есть в рантайме, но не в публичных типах Vue. */
function getSetupState(instance: ComponentInternalInstance): Record<string, unknown> | undefined {
    return (instance as unknown as { setupState?: Record<string, unknown> }).setupState
}

function detectStoreId(target: object): string | null {
    const id = (target as { $id?: unknown }).$id
    return typeof id === 'string' ? id : null
}

/**
 * Превращает событие реактивности Vue в понятную человеку причину.
 * Это то, ради чего пакет существует: React-инструментам приходится
 * угадывать причину диффом пропсов, а Vue отдаёт её напрямую.
 */
export function describeTrigger(
    event: DebuggerEvent,
    instance?: ComponentInternalInstance | null,
): RenderReason {
    const target = event.target as object
    const rawKey = normalizeKey(event.key)

    let source: ReasonSource = 'unknown'
    let key = rawKey

    const storeId = detectStoreId(target)

    if (instance && instance.props && toRaw(instance.props) === target) {
        source = 'props'
    }
    else if (storeId) {
        source = 'store'
        key = `${storeId}.${rawKey}`
    }
    else if (Array.isArray(target)) {
        source = 'array'
        key = `[${rawKey}]`
    }
    else if (target instanceof Map || target instanceof Set) {
        source = 'collection'
    }
    else if (instance && instance.data && toRaw(instance.data) === target) {
        source = 'data'
    }
    else if (rawKey === 'value') {
        // Реф: сам по себе он анонимен, имя есть только в setupState.
        const refName = instance ? findRefName(getSetupState(instance), target) : null
        if (refName) {
            source = 'setup'
            key = refName
        }
        else {
            source = 'setup'
            key = 'ref'
        }
    }
    else if (instance && getSetupState(instance) && toRaw(getSetupState(instance)!) === target) {
        source = 'setup'
    }

    const reason: RenderReason = { type: String(event.type), key, source }
    if ('oldValue' in event) reason.oldValue = formatValue(event.oldValue)
    if ('newValue' in event) reason.newValue = formatValue(event.newValue)
    return reason
}

/** Схлопывает повторы: за один тик один и тот же ключ триггерится пачками. */
export function dedupeReasons(reasons: RenderReason[], limit = 10): RenderReason[] {
    const seen = new Map<string, RenderReason>()
    for (const reason of reasons) {
        const id = `${reason.source}:${reason.key}:${reason.type}`
        if (!seen.has(id)) seen.set(id, reason)
        if (seen.size >= limit) break
    }
    return [...seen.values()]
}

export function snapshotProps(props: Record<string, unknown> | null | undefined): Record<string, unknown> {
    if (!props) return {}
    return { ...toRaw(props) }
}

/**
 * Диф пропсов между beforeUpdate и updated.
 * referenceOnly отмечает случай «новый объект с тем же содержимым» —
 * это почти всегда лишний рендер из-за литерала в шаблоне родителя.
 */
export function diffProps(
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
): PropChange[] {
    if (!before || !after) return []

    const changes: PropChange[] = []
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])

    for (const key of keys) {
        const oldValue = before[key]
        const newValue = after[key]
        if (Object.is(oldValue, newValue)) continue

        changes.push({
            key,
            oldValue: formatValue(oldValue),
            newValue: formatValue(newValue),
            referenceOnly: isShallowEqual(oldValue, newValue),
        })
    }
    return changes
}

function isShallowEqual(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) return true
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false

    const rawA = toRaw(a) as Record<string, unknown>
    const rawB = toRaw(b) as Record<string, unknown>
    if (Array.isArray(rawA) !== Array.isArray(rawB)) return false

    const keysA = Object.keys(rawA)
    const keysB = Object.keys(rawB)
    if (keysA.length !== keysB.length) return false
    return keysA.every(key => Object.is(rawA[key], rawB[key]))
}
