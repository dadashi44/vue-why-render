import { afterEach, describe, expect, it } from 'vitest'
import { createApp, defineComponent, h, nextTick, reactive, ref } from 'vue'
import type { App } from 'vue'
import { createPinia, defineStore } from 'pinia'
import type { Pinia } from 'pinia'
import { scan } from '../src/index'
import type { ScanHandle } from '../src/index'
import { formatReason } from '../src/panel/format'
import { getMessages } from '../src/i18n'
import type { RenderReason, VueWhyRenderOptions } from '../src/types'

/**
 * Проверки на настоящей Pinia, а не на объекте с `$id`: прежний тест проверял
 * мою трактовку того, где срабатывает реактивность стора, — и трактовка была
 * неверной. Причина «стор» не определялась ни в одном реальном случае.
 */

const useCart = defineStore('cart', {
    state: () => ({ items: [] as string[], count: 0, meta: { open: false, deep: { level: 1 } } }),
    actions: {
        addItem(name: string) {
            this.items.push(name)
        },
        bump() {
            this.count++
        },
        toggle() {
            this.meta.open = !this.meta.open
        },
        dig() {
            this.meta.deep.level++
        },
        outer() {
            this.inner()
        },
        inner() {
            this.count += 10
        },
        async later() {
            await Promise.resolve()
            this.count = 100
        },
        broken() {
            this.count = -1
            throw new Error('boom')
        },
    },
})

const useOrders = defineStore('orders', {
    state: () => ({ list: [] as Array<{ qty: number }>, current: null as { qty: number } | null }),
})

const useLate = defineStore('late', { state: () => ({ value: 0 }) })

const useCounter = defineStore('counter', () => {
    const total = ref(0)
    const box = reactive({ size: 1 })
    function inc() {
        total.value++
    }
    function grow() {
        box.size++
    }
    return { total, box, inc, grow }
})

let app: App | null = null
let handle: ScanHandle | null = null

afterEach(() => {
    handle?.stop()
    app?.unmount()
    app = null
    handle = null
})

type Vm = { cart: ReturnType<typeof useCart>, counter: ReturnType<typeof useCounter>, local: number }

function start(options: VueWhyRenderOptions = {}, install: 'before' | 'after' | 'none' = 'before') {
    const Root = defineComponent({
        name: 'Root',
        setup() {
            const local = ref(0)
            return { cart: useCart(), counter: useCounter(), local }
        },
        render() {
            const { cart, counter } = this
            return h('div', [
                cart.items.join(','), cart.count, String(cart.meta.open), cart.meta.deep.level,
                counter.total, counter.box.size, this.local,
            ].join(' '))
        },
    })
    app = createApp(Root)
    const pinia: Pinia = createPinia()
    if (install === 'before') app.use(pinia)
    handle = scan(app, { panel: false, overlay: false, devtools: false, ...options })!
    if (install === 'after') app.use(pinia)
    const vm = app.mount(document.createElement('div')) as unknown as Vm
    return vm
}

async function reasonsOf(step: () => unknown): Promise<RenderReason[]> {
    const before = handle!.getEvents().length
    try {
        await step()
    }
    catch {
        // broken() бросает нарочно.
    }
    await nextTick()
    await nextTick()
    return handle!.getEvents().slice(before).flatMap(event => event.reasons)
}

describe('Pinia: где изменилось', () => {
    it('поле option-стора', async () => {
        const vm = start()
        expect(await reasonsOf(() => vm.cart.bump())).toEqual([
            { type: 'set', key: 'cart.count', source: 'store', store: 'cart', oldValue: '0', newValue: '1', action: 'bump' },
        ])
    })

    it('вложенное поле — с путём', async () => {
        const vm = start()
        const [open] = await reasonsOf(() => vm.cart.toggle())
        expect(open).toMatchObject({ key: 'cart.meta.open', store: 'cart' })
        const [level] = await reasonsOf(() => vm.cart.dig())
        expect(level).toMatchObject({ key: 'cart.meta.deep.level', oldValue: '1', newValue: '2' })
    })

    it('push в массив — сам массив, без индекса и бессмысленного undefined → "a"', async () => {
        const vm = start()
        const first = await reasonsOf(() => vm.cart.addItem('a'))
        const second = await reasonsOf(() => vm.cart.addItem('b'))
        expect(first[0]).toEqual({ type: 'add', key: 'cart.items', source: 'store', store: 'cart', action: 'addItem' })
        // Один и тот же ключ — для диффа и частот это одна причина.
        expect(second[0].key).toBe(first[0].key)
    })

    it('замена элемента массива сохраняет индекс и значения', async () => {
        const vm = start()
        await reasonsOf(() => vm.cart.addItem('a'))
        const [reason] = await reasonsOf(() => {
            vm.cart.items[0] = 'z'
        })
        expect(reason).toMatchObject({ type: 'set', key: 'cart.items[0]', oldValue: '"a"', newValue: '"z"' })
    })

    it('реф setup-стора — стор, а не локальный реф компонента', async () => {
        const vm = start()
        expect(await reasonsOf(() => vm.counter.inc())).toEqual([
            { type: 'set', key: 'counter.total', source: 'store', store: 'counter', oldValue: '0', newValue: '1', action: 'inc' },
        ])
    })

    it('reactive внутри setup-стора', async () => {
        const vm = start()
        const [reason] = await reasonsOf(() => vm.counter.grow())
        expect(reason).toMatchObject({ key: 'counter.box.size', store: 'counter', action: 'grow' })
    })

    it('локальный реф компонента остаётся локальным', async () => {
        const vm = start()
        const [reason] = await reasonsOf(() => {
            vm.local++
        })
        expect(reason).toMatchObject({ source: 'setup', key: 'local' })
        expect(reason.store).toBeUndefined()
    })
})

describe('Pinia: объекты, положенные в стор позже', () => {
    function startOrders() {
        const Root = defineComponent({
            name: 'Orders',
            setup: () => ({ orders: useOrders() }),
            render() {
                const { orders } = this
                return h('div', [orders.list.map(item => item.qty).join(','), orders.current?.qty ?? '-'].join(' '))
            },
        })
        app = createApp(Root)
        app.use(createPinia())
        handle = scan(app, { panel: false, overlay: false, devtools: false })!
        return app.mount(document.createElement('div')) as unknown as { orders: ReturnType<typeof useOrders> }
    }

    it('элемент, добавленный push, узнаётся при следующем изменении', async () => {
        const vm = startOrders()
        await reasonsOf(() => vm.orders.list.push({ qty: 1 }))
        const [reason] = await reasonsOf(() => {
            vm.orders.list[0].qty++
        })
        expect(reason).toMatchObject({ key: 'orders.list[0].qty', store: 'orders', oldValue: '1', newValue: '2' })
    })

    it('объект, присвоенный полю, — тоже', async () => {
        const vm = startOrders()
        await reasonsOf(() => {
            vm.orders.current = { qty: 5 }
        })
        const [reason] = await reasonsOf(() => {
            vm.orders.current!.qty = 6
        })
        expect(reason).toMatchObject({ key: 'orders.current.qty', store: 'orders' })
    })

    it('стор, созданный уже после подключения, узнаётся', async () => {
        // Стор создаётся в setup ребёнка, который появляется позже, —
        // к этому моменту сканер давно подключён, и стор приходит через pinia.use.
        const LateView = defineComponent({
            name: 'LateView',
            setup: () => ({ late: useLate() }),
            render() {
                return h('span', String(this.late.value))
            },
        })
        const Root = defineComponent({
            name: 'Host',
            setup: () => ({ show: ref(false), orders: useOrders() }),
            render() {
                return h('div', [String(this.orders.list.length), this.show ? h(LateView) : null])
            },
        })
        app = createApp(Root)
        const pinia = createPinia()
        app.use(pinia)
        handle = scan(app, { panel: false, overlay: false, devtools: false, include: ['LateView'] })!
        const vm = app.mount(document.createElement('div')) as unknown as { show: boolean }

        expect(pinia._s.has('late')).toBe(false)
        vm.show = true
        await nextTick()
        expect(pinia._s.has('late')).toBe(true)

        const reasons = await reasonsOf(() => {
            useLate(pinia).value++
        })
        expect(reasons[0]).toMatchObject({ key: 'late.value', store: 'late' })
    })
})

describe('Pinia: кто изменил', () => {
    it('прямое присваивание и $patch — без экшена', async () => {
        const vm = start()
        const [direct] = await reasonsOf(() => {
            vm.cart.count = 5
        })
        expect(direct).toMatchObject({ key: 'cart.count', store: 'cart' })
        expect(direct.action).toBeUndefined()

        const [patched] = await reasonsOf(() => vm.cart.$patch({ count: 9 }))
        expect(patched).toMatchObject({ key: 'cart.count', newValue: '9' })
        expect(patched.action).toBeUndefined()
    })

    it('во вложенном вызове называет внутренний экшен', async () => {
        const vm = start()
        const [reason] = await reasonsOf(() => vm.cart.outer())
        expect(reason.action).toBe('inner')
    })

    it('асинхронный экшен — и после await', async () => {
        const vm = start()
        const [reason] = await reasonsOf(() => vm.cart.later())
        expect(reason).toMatchObject({ key: 'cart.count', newValue: '100', action: 'later' })
    })

    it('экшен, бросивший ошибку, не прилипает к следующим изменениям', async () => {
        const vm = start()
        const [failed] = await reasonsOf(() => vm.cart.broken())
        expect(failed.action).toBe('broken')
        const [next] = await reasonsOf(() => {
            vm.cart.count = 3
        })
        expect(next.action).toBeUndefined()
    })
})

describe('Pinia: подключение', () => {
    it('находит Pinia, установленную после сканера', async () => {
        const vm = start({}, 'after')
        const [reason] = await reasonsOf(() => vm.cart.bump())
        expect(reason).toMatchObject({ key: 'cart.count', store: 'cart', action: 'bump' })
    })

    it('pinia: false — прежнее поведение', async () => {
        const vm = start({ pinia: false })
        const [reason] = await reasonsOf(() => vm.cart.bump())
        expect(reason.store).toBeUndefined()
        expect(reason.source).not.toBe('store')
    })

    it('без Pinia в приложении ничего не ломается', async () => {
        const Root = defineComponent({
            name: 'Plain',
            setup: () => ({ n: ref(0) }),
            render() {
                return h('div', String(this.n))
            },
        })
        app = createApp(Root)
        handle = scan(app, { panel: false, overlay: false, devtools: false })!
        const vm = app.mount(document.createElement('div')) as unknown as { n: number }
        vm.n++
        await nextTick()
        expect(handle.getEvents()[0].reasons[0]).toMatchObject({ source: 'setup', key: 'n' })
    })

    it('после stop экшены больше не отслеживаются', async () => {
        const vm = start()
        await reasonsOf(() => vm.cart.bump())
        const cart = vm.cart
        handle!.stop()
        handle = null
        // Подписки на $onAction сняты: экшен отрабатывает, и ничего не падает.
        expect(() => cart.bump()).not.toThrow()
    })
})

describe('formatReason со стором', () => {
    const en = getMessages('en')
    const ru = getMessages('ru')

    it('дописывает экшен последним', () => {
        const reason: RenderReason = { type: 'set', key: 'cart.count', source: 'store', store: 'cart', oldValue: '0', newValue: '1', action: 'bump' }
        expect(formatReason(reason, en)).toBe('store cart.count: 0 → 1 · action bump()')
        expect(formatReason(reason, ru)).toBe('стор cart.count: 0 → 1 · экшен bump()')
    })

    it('добавление в массив', () => {
        const reason: RenderReason = { type: 'add', key: 'cart.items', source: 'store', store: 'cart', action: 'addItem' }
        expect(formatReason(reason, en)).toBe('store cart.items (add) · action addItem()')
    })
})
