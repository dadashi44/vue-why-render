import type { AppContext } from 'vue'
import { isRef, toRaw } from 'vue'

/**
 * Vue Router без зависимости от него — утиная типизация по тому, что
 * роутер 4 и 5 одинаково кладут на виду: `globalProperties.$router` и
 * `router.currentRoute` — shallowRef с текущим маршрутом.
 *
 * Зачем. И `useRoute()`, и `$route` в шаблоне читают `currentRoute.value`,
 * поэтому любая навигация приходит событием на этот реф, а старое и новое
 * значения — маршруты целиком. Без этого модуля причина выглядела как
 * «состояние ref: { fullPath, path, query, … } → { fullPath, path, query, … }»
 * — ни что поменялось, ни что это вообще маршрут.
 */

interface RouteLike {
    path?: unknown
    fullPath?: unknown
    name?: unknown
    hash?: unknown
    params?: Record<string, unknown>
    query?: Record<string, unknown>
}

interface RouterLike {
    currentRoute: object
    push: (...args: unknown[]) => unknown
}

export interface RouteChange {
    /** Что поменялось: `params.id`, `query.tab, hash`, `path`. */
    key: string
    /** Пути до и после — видно и что, и откуда куда. */
    from: string
    to: string
}

function isRouter(value: unknown): value is RouterLike {
    const candidate = value as Partial<RouterLike> | null
    return Boolean(candidate && typeof candidate === 'object'
        && candidate.currentRoute && isRef(candidate.currentRoute) && typeof candidate.push === 'function')
}

/** Значение параметра для сравнения: у повторяющихся параметров это массив. */
function same(a: unknown, b: unknown): boolean {
    if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b)
    return String(a ?? '') === String(b ?? '')
}

function changedKeys(prefix: string, before: Record<string, unknown> = {}, after: Record<string, unknown> = {}): string[] {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    return [...keys].filter(key => !same(before[key], after[key])).map(key => `${prefix}.${key}`)
}

/**
 * Что поменялось между двумя маршрутами. Параметры, query и hash называются
 * по ключам: «параметр id» — это причина, а «путь» — её следствие. Путь —
 * только если ничего из этого не поменялось, то есть сменилась сама страница.
 */
export function describeRouteChange(before: RouteLike | null | undefined, after: RouteLike | null | undefined): RouteChange {
    const from = String(before?.fullPath ?? before?.path ?? '')
    const to = String(after?.fullPath ?? after?.path ?? '')

    const parts = [
        ...changedKeys('params', before?.params, after?.params),
        ...changedKeys('query', before?.query, after?.query),
        ...(same(before?.hash, after?.hash) ? [] : ['hash']),
    ]
    if (!parts.length && !same(before?.path, after?.path)) parts.push('path')
    if (!parts.length && !same(before?.name, after?.name)) parts.push('name')

    return { key: parts.length ? parts.join(', ') : 'route', from, to }
}

export class RouterTracker {
    private currentRoute: object | null = null

    /** Как у Pinia: дёшево и зовётся на новых компонентах, пока не найдём. */
    connect(context: AppContext | null | undefined): boolean {
        if (this.currentRoute) return true
        if (!context) return false
        const router = (context.config.globalProperties as { $router?: unknown }).$router
        if (!isRouter(router)) return false
        this.currentRoute = toRaw(router.currentRoute)
        return true
    }

    /** Это событие на текущем маршруте? Сравнение по ссылке — реф у роутера один. */
    owns(target: unknown): boolean {
        return this.currentRoute !== null && target === this.currentRoute
    }

    dispose(): void {
        this.currentRoute = null
    }
}
