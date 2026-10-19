import type { AppContext } from 'vue'
import { isRef, toRaw } from 'vue'

/**
 * Поддержка Pinia без зависимости от неё. Всё, что нужно, — утиная типизация
 * по тому, что Pinia 2, 3 и 4 одинаково кладут на виду:
 * `app.config.globalProperties.$pinia`, `pinia.state` (реф с объектом
 * `{ [storeId]: state }`), `pinia._s` (живые сторы) и `pinia.use`.
 *
 * Зачем это вообще. Vue сообщает, на каком объекте сработала реактивность, но
 * у стора это не сам стор: `cart.count++` срабатывает на объекте состояния
 * `pinia.state.value.cart`, `cart.items.push()` — на массиве, а у setup-стора —
 * на его рефе. Ни на одном из них нет `$id`, и без этого модуля причина
 * выглядела как «реактивность count» или, хуже, как локальный реф компонента.
 */

interface StoreLike {
    $id: string
    $onAction: (
        callback: (context: {
            name: string
            after: (fn: () => void) => void
            onError: (fn: () => void) => void
        }) => void,
        detached?: boolean,
    ) => () => void
}

interface PiniaLike {
    state: { value: Record<string, unknown> }
    _s?: Map<string, StoreLike>
    use: (plugin: (context: { store: StoreLike }) => void) => unknown
}

export interface StoreLocation {
    /** id стора. */
    store: string
    /** Путь внутри состояния: `items`, `meta.open`, `items.length`. */
    path: string
}

/**
 * Сколько узлов одного стора индексируем. Огромный массив в состоянии
 * проиндексируется не целиком — и его хвост будет причиной без имени стора, —
 * зато подключение стора не повесит приложение.
 */
const NODE_BUDGET = 500
/** Насколько глубоко во вложенные объекты состояния заглядываем. */
const MAX_DEPTH = 4

function isPinia(value: unknown): value is PiniaLike {
    const candidate = value as Partial<PiniaLike> | null
    return Boolean(candidate && typeof candidate === 'object'
        && candidate.state && isRef(candidate.state) && typeof candidate.use === 'function')
}

function isStore(value: unknown): value is StoreLike {
    const candidate = value as Partial<StoreLike> | null
    return Boolean(candidate && typeof candidate.$id === 'string' && typeof candidate.$onAction === 'function')
}

/**
 * Значение рефа без трекинга. Мы внутри renderTriggered — то есть посреди чужой
 * мутации, и обычное `.value` подписало бы выполняющийся сейчас эффект на
 * лишнюю зависимость. `_rawValue` есть у RefImpl во всех версиях Vue 3; если
 * его нет (кастомный реф), лучше ничего не узнать, чем что-то сломать.
 */
function peek(ref: object): unknown {
    return (ref as { _rawValue?: unknown })._rawValue
}

/** Свои значения объекта без вызова геттеров — та же осторожность, что в reason.ts. */
function ownValues(target: object): Array<[string, unknown]> {
    const out: Array<[string, unknown]> = []
    const descriptors = Object.getOwnPropertyDescriptors(target)
    for (const key of Object.keys(descriptors)) {
        const descriptor = descriptors[key]
        if (!descriptor || typeof descriptor.get === 'function') continue
        out.push([key, descriptor.value])
    }
    return out
}

/** Хвост пути по ключу из события: `[3]` для индекса, `.length`, `.open`. */
export function appendKey(path: string, target: object, key: string): string {
    if (target instanceof Map || target instanceof Set) return path
    if (Array.isArray(target)) return /^\d+$/.test(key) ? `${path}[${key}]` : `${path}.${key}`
    return path ? `${path}.${key}` : key
}

/**
 * Путь до объекта плюс ключ из события. У рефа ключ всегда `value` — он ничего
 * не говорит, имя рефа и есть путь: `counter.total`, а не `counter.total.value`.
 */
function withKey(location: StoreLocation, target: object, key: string): StoreLocation {
    if (isRef(target)) return location
    return { store: location.store, path: appendKey(location.path, target, key) }
}

export class PiniaTracker {
    private pinia: PiniaLike | null = null
    private disposed = false
    /** Стек выполняющихся экшенов по стору: вложенный вызов — наверху. */
    private running = new Map<string, string[]>()
    private watched = new WeakSet<object>()
    private stops: Array<() => void> = []
    /**
     * Индекс «объект состояния → место в сторе». Строится один раз при
     * подключении стора и дописывается, когда в стор кладут новый объект.
     * Поиск — одно чтение из WeakMap: обход состояния на каждый триггер
     * стоил ~120 мкс на десятке сторов, а промахи (локальные рефы компонентов)
     * случаются куда чаще попаданий.
     */
    private index = new WeakMap<object, StoreLocation>()

    /**
     * Подключиться к Pinia приложения, если она уже установлена. Дёшево —
     * одно чтение свойства, — поэтому зовётся на каждом новом компоненте,
     * пока не получится: порядок `app.use(pinia)` и нашего плагина не задан.
     */
    connect(context: AppContext | null | undefined): boolean {
        if (this.pinia) return true
        if (this.disposed || !context) return false

        const pinia = (context.config.globalProperties as { $pinia?: unknown }).$pinia
        if (!isPinia(pinia)) return false
        this.pinia = pinia

        for (const store of pinia._s?.values() ?? []) this.watch(store)
        // use() нельзя отменить, поэтому плагин сам гаснет после dispose.
        pinia.use(({ store }) => {
            if (!this.disposed) this.watch(store)
        })
        return true
    }

    private watch(store: unknown): void {
        if (!isStore(store)) return
        const raw = toRaw(store)
        if (this.watched.has(raw)) return
        this.watched.add(raw)

        const id = store.$id
        const states = this.pinia ? peek(this.pinia.state) : null
        const state = states && typeof states === 'object' ? (states as Record<string, unknown>)[id] : null
        if (state && typeof state === 'object') this.indexTree(id, toRaw(state as object), '', MAX_DEPTH, { left: NODE_BUDGET })

        // detached: иначе подписка умрёт вместе с компонентом, первым вызвавшим стор.
        const stop = store.$onAction(({ name, after, onError }) => {
            const stack = this.running.get(id) ?? []
            stack.push(name)
            this.running.set(id, stack)

            let finished = false
            const finish = (): void => {
                if (finished) return
                finished = true
                const index = stack.lastIndexOf(name)
                if (index !== -1) stack.splice(index, 1)
            }
            after(finish)
            onError(finish)
        }, true)
        this.stops.push(stop)
    }

    /**
     * Экшен, который сейчас выполняется в сторе. Асинхронный считается
     * выполняющимся до своего завершения — мутация после `await` тоже его.
     */
    activeAction(store: string): string | undefined {
        const stack = this.running.get(store)
        return stack?.length ? stack[stack.length - 1] : undefined
    }

    /**
     * Где в состоянии сторов лежит объект, на котором сработала реактивность.
     * `null` — это не стор, и причину определяет обычная логика.
     *
     * `newValue` — новое значение из события: если в стор положили объект,
     * его поддерево сразу попадает в индекс, и следующее изменение внутри
     * (`cart.items[3].qty++`) тоже узнаётся.
     */
    locate(target: object, key: string, newValue?: unknown): StoreLocation | null {
        const known = this.index.get(target)
        if (!known) return null

        const location = withKey(known, target, key)
        if (newValue && typeof newValue === 'object') {
            const raw = toRaw(newValue as object)
            // Путь нового значения — с индексом элемента, даже если в причине он схлопнется.
            const path = isRef(target) ? known.path : appendKey(known.path, target, key)
            this.indexTree(known.store, raw, path, MAX_DEPTH, { left: NODE_BUDGET })
        }
        return location
    }

    /** Занести узел и его потомков в индекс. Рефы — и сам реф, и его значение. */
    private indexTree(store: string, node: object, path: string, depth: number, budget: { left: number }): void {
        this.index.set(node, { store, path })
        if (depth <= 0) return

        for (const [key, value] of ownValues(node)) {
            if (!value || typeof value !== 'object') continue
            if (--budget.left < 0) return
            const childPath = appendKey(path, node, key)

            if (isRef(value)) {
                // Реф setup-стора: событие приходит на сам реф, и путь — его имя.
                this.index.set(value, { store, path: childPath })
                const inner = peek(value)
                if (inner && typeof inner === 'object') this.indexTree(store, toRaw(inner as object), childPath, depth - 1, budget)
                continue
            }
            this.indexTree(store, toRaw(value as object), childPath, depth - 1, budget)
        }
    }

    dispose(): void {
        this.disposed = true
        for (const stop of this.stops) stop()
        this.stops = []
        this.running.clear()
        this.pinia = null
    }
}
