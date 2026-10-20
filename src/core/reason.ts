import type { ComponentInternalInstance, DebuggerEvent } from 'vue'
import { isRef, toRaw } from 'vue'
import type { PropChange, ReasonSource, RenderReason } from '../types'
import type { PiniaTracker } from './pinia'
import type { RouterTracker } from './router'
import { describeRouteChange } from './router'

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

function detectStoreId(target: unknown): string | null {
    if (!target || typeof target !== 'object') return null
    const id = (target as { $id?: unknown }).$id
    return typeof id === 'string' ? id : null
}

/** Флаг «значение устарело» у computed в Vue 3.5 — EffectFlags.DIRTY. */
const COMPUTED_DIRTY = 16

interface DepLink {
    dep?: { computed?: object & { flags?: number } }
    nextDep?: DepLink
}

/**
 * Computed, из-за которых пришёл триггер.
 *
 * В Vue 3.5 computed оповещает подписчиков без отладочной информации:
 * у события нет ни target, ни key. Но к моменту оповещения computed уже
 * помечен устаревшим, а рендер-эффект компонента держит список своих
 * зависимостей — среди них и устаревшие computed. Это внутренности Vue,
 * поэтому любой сбой здесь — пустой список, а не падение.
 */
function dirtyComputeds(instance: ComponentInternalInstance): object[] {
    const out: object[] = []
    try {
        let link = (instance as unknown as { effect?: { deps?: DepLink } }).effect?.deps
        for (let guard = 0; link && guard < 256; guard++) {
            const computed = link.dep?.computed
            if (computed && typeof computed.flags === 'number' && (computed.flags & COMPUTED_DIRTY)) out.push(computed)
            link = link.nextDep
        }
    }
    catch {
        return []
    }
    return out
}

/**
 * Имя устаревшего computed из setupState. Без имени — просто «computed»:
 * computed мог быть объявлен вне компонента, в композабле или в сторе, и
 * назвать его нечем, а выдумывать имя хуже, чем честно сказать, что это computed.
 */
function describeComputed(instance: ComponentInternalInstance | null | undefined): string {
    if (!instance) return 'computed'
    const dirty = dirtyComputeds(instance)
    const setupState = getSetupState(instance)
    const names = dirty.map(computed => findRefName(setupState, computed)).filter((name): name is string => Boolean(name))
    return names.length ? names.join(', ') : 'computed'
}

/**
 * Превращает событие реактивности Vue в понятную человеку причину.
 * Это то, ради чего пакет существует: React-инструментам приходится
 * угадывать причину диффом пропсов, а Vue отдаёт её напрямую.
 */
export function describeTrigger(
    event: DebuggerEvent,
    instance?: ComponentInternalInstance | null,
    pinia?: PiniaTracker | null,
    router?: RouterTracker | null,
): RenderReason {
    const target = event.target as object | undefined

    // Без target — это computed (Vue 3.5 не передаёт для него отладочной
    // информации). Раньше здесь всё падало на `target.$id`, причина терялась,
    // и подсказка ошибочно советовала v-memo: «свои данные не менялись».
    if (!target || typeof target !== 'object') {
        return { type: 'computed', key: describeComputed(instance), source: 'computed' }
    }

    // Навигация — раньше остального: currentRoute это реф, и без этой ветки
    // он ушёл бы в «состояние ref» с двумя маршрутами целиком в значениях.
    if (router?.owns(target)) {
        const change = describeRouteChange(
            ('oldValue' in event ? event.oldValue : undefined) as never,
            ('newValue' in event ? event.newValue : undefined) as never,
        )
        return { type: 'set', key: change.key, source: 'route', oldValue: formatValue(change.from), newValue: formatValue(change.to) }
    }

    const rawKey = normalizeKey(event.key)

    let source: ReasonSource = 'unknown'
    let key = rawKey
    let store: string | undefined

    const storeId = detectStoreId(target)
    // Стор — раньше рефа и массива: реф setup-стора и массив в состоянии стора
    // иначе уходили в «локальный реф компонента» и «массив [0]».
    const location = pinia && target && typeof target === 'object'
        ? pinia.locate(target, rawKey, 'newValue' in event ? event.newValue : undefined)
        : null

    if (instance && instance.props && toRaw(instance.props) === target) {
        source = 'props'
    }
    else if (location) {
        source = 'store'
        store = location.store
        key = location.path ? `${location.store}.${location.path}` : location.store
    }
    else if (storeId) {
        store = storeId
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

    const type = String(event.type)
    // Добавление и удаление элемента массива в сторе: индекс у каждого push
    // свой, и `cart.items[0]`, `cart.items[1]`... — разные причины для диффа,
    // частот и бюджетов, хотя по смыслу одна. А «undefined → "a"» ничего не
    // объясняет. Поэтому ключ — сам массив, тип — что с ним сделали.
    const arrayMember = Boolean(location) && Array.isArray(target) && /^\d+$/.test(rawKey)
        && (type === 'add' || type === 'delete')
    if (arrayMember) key = key.replace(/\[\d+\]$/, '')

    const reason: RenderReason = { type, key, source }
    if (!arrayMember) {
        if ('oldValue' in event) reason.oldValue = formatValue(event.oldValue)
        if ('newValue' in event) reason.newValue = formatValue(event.newValue)
    }
    if (store) {
        reason.store = store
        const action = pinia?.activeAction(store)
        if (action) reason.action = action
    }
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
            newFunction: typeof oldValue === 'function' && typeof newValue === 'function',
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
