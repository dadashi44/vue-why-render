import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, createApp, defineComponent, h, nextTick, ref } from 'vue'
import type { App } from 'vue'
import { scan } from '../src/index'
import type { ScanHandle } from '../src/index'
import { describeTrigger } from '../src/core/reason'
import { hintsForRecord } from '../src/core/hints'
import { formatReason } from '../src/panel/format'
import { getMessages } from '../src/i18n'
import { resolveOptions } from '../src/options'

/**
 * В Vue 3.5 computed оповещает подписчиков без target и key. До этих тестов
 * определение причины на таком событии падало, рендер оставался без причины,
 * а подсказка советовала v-memo: «свои данные не менялись». Проверяется на
 * настоящих computed, а не на подделанном событии, — подделка проверила бы
 * мою трактовку того, что Vue передаёт.
 */

let app: App | null = null
let handle: ScanHandle | null = null

afterEach(() => {
    handle?.stop()
    app?.unmount()
    app = null
    handle = null
    vi.restoreAllMocks()
})

async function run(component: ReturnType<typeof defineComponent>, step: (vm: Record<string, unknown>) => void) {
    app = createApp(component)
    handle = scan(app, { panel: false, overlay: false, devtools: false })!
    const vm = app.mount(document.createElement('div')) as unknown as Record<string, unknown>
    step(vm)
    await nextTick()
    return handle.getEvents()
}

describe('причина — computed', () => {
    it('называет computed из setup по имени', async () => {
        const warn = vi.spyOn(console, 'warn')
        const events = await run(defineComponent({
            name: 'Total',
            setup() {
                const price = ref(10)
                const total = computed(() => price.value * 2)
                return { price, total }
            },
            render() {
                return h('div', String(this.total))
            },
        }), (vm) => {
            vm.price = 20
        })

        expect(events[0].reasons).toEqual([{ type: 'computed', key: 'total', source: 'computed' }])
        expect(warn).not.toHaveBeenCalled()
    })

    it('computed вне компонента — честно «computed», без выдуманного имени', async () => {
        const count = ref(1)
        const doubled = computed(() => count.value * 2)
        const events = await run(defineComponent({
            name: 'Outside',
            render: () => h('div', String(doubled.value)),
        }), () => {
            count.value++
        })
        expect(events[0].reasons).toEqual([{ type: 'computed', key: 'computed', source: 'computed' }])
    })

    // Vue уведомляет рендер один раз, через тот computed, что успел первым, —
    // второй к этому моменту может ещё не быть помечен. Обещание поэтому
    // скромнее: имя настоящее, но не обязательно все сразу.
    it('из двух устаревших computed называет настоящее имя, а не выдуманное', async () => {
        const events = await run(defineComponent({
            name: 'Pair',
            setup() {
                const base = ref(1)
                const a = computed(() => base.value + 1)
                const b = computed(() => base.value + 2)
                return { base, a, b }
            },
            render() {
                return h('div', `${this.a} ${this.b}`)
            },
        }), (vm) => {
            vm.base = 5
        })
        const names = events[0].reasons[0].key.split(', ')
        expect(names.length).toBeGreaterThan(0)
        expect(names.every(name => ['a', 'b'].includes(name))).toBe(true)
    })

    it('не советует v-memo: перерисовка пришла от своего computed, а не от родителя', async () => {
        const events = await run(defineComponent({
            name: 'Total',
            setup() {
                const price = ref(10)
                const total = computed(() => price.value * 2)
                return { price, total }
            },
            render() {
                return h('div', String(this.total))
            },
        }), (vm) => {
            vm.price = 30
        })
        const record = handle!.getStats().find(item => item.name === 'Total')!
        expect(events).toHaveLength(1)
        expect(hintsForRecord(record, resolveOptions({ enabled: true }))).toEqual([])
    })

    it('событие без target и без инстанса не роняет определение причины', () => {
        expect(describeTrigger({} as never)).toEqual({ type: 'computed', key: 'computed', source: 'computed' })
    })

    it('подпись — без повтора «(computed)»', () => {
        expect(formatReason({ type: 'computed', key: 'total', source: 'computed' }, getMessages('en'))).toBe('computed total')
        expect(formatReason({ type: 'computed', key: 'total', source: 'computed' }, getMessages('zh-CN'))).toBe('计算属性 total')
    })
})
