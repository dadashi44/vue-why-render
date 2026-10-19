import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import type { App } from 'vue'
import { Registry } from '../src/core/registry'
import { watchBudgets } from '../src/core/budgets'
import { createReport } from '../src/core/report'
import { resolveOptions } from '../src/options'
import { scan } from '../src/index'
import type { ScanHandle } from '../src/index'
import type { RenderEvent, VueWhyRenderOptions } from '../src/types'

function event(partial: Partial<RenderEvent> = {}): RenderEvent {
    return {
        uid: 1, name: 'Card', file: '/app/src/Card.vue', phase: 'update', duration: 1, fps: 60,
        timestamp: 0, reasons: [], propChanges: [], ...partial,
    }
}

function setup(options: VueWhyRenderOptions) {
    const registry = new Registry()
    registry.register({ uid: 1, name: 'Card', file: '/app/src/Card.vue', parentUid: null })
    registry.register({ uid: 2, name: 'Card', file: '/app/src/Card.vue', parentUid: null })
    registry.register({ uid: 3, name: 'Other', parentUid: null })
    const resolved = resolveOptions({ enabled: true, ...options })
    const stop = watchBudgets(registry, resolved)
    return { registry, resolved, stop }
}

afterEach(() => {
    vi.restoreAllMocks()
})

describe('watchBudgets: частота', () => {
    it('ловит больше maxRenders за окно и пишет худшее значение', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const { registry } = setup({ budgets: { maxRenders: 2, per: 1000 } })

        for (const timestamp of [0, 100, 200, 300]) registry.record(event({ timestamp }))

        const [violation] = registry.getViolations()
        expect(violation).toMatchObject({ kind: 'renders', name: 'Card', key: '/app/src/Card.vue::Card', limit: 2, actual: 4, per: 1000, count: 2 })
        // В консоль — один раз, хотя превышений два.
        expect(warn).toHaveBeenCalledTimes(1)
        expect(warn.mock.calls[0][0]).toBe('[vue-why-render] budget exceeded: Card rendered 3 times in 1000ms (limit 2)')
    })

    it('рендеры вне окна не считаются', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        const { registry } = setup({ budgets: { maxRenders: 2, per: 1000 } })
        for (const timestamp of [0, 600, 1200, 1800]) registry.record(event({ timestamp }))
        expect(registry.getViolations()).toEqual([])
    })

    it('окно у каждого инстанса своё: два инстанса по разу — не нарушение', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        const { registry } = setup({ budgets: { maxRenders: 1 } })
        registry.record(event({ uid: 1, timestamp: 0 }))
        registry.record(event({ uid: 2, timestamp: 10 }))
        expect(registry.getViolations()).toEqual([])
    })

    it('include ограничивает бюджет нужными компонентами', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        const { registry } = setup({ budgets: { maxRenders: 1, include: [/^Other$/] } })
        for (const timestamp of [0, 10, 20]) registry.record(event({ timestamp }))
        expect(registry.getViolations()).toEqual([])
        for (const timestamp of [0, 10]) registry.record(event({ uid: 3, name: 'Other', file: undefined, timestamp }))
        expect(registry.getViolations().map(item => item.name)).toEqual(['Other'])
    })

    it('сброс реестра начинает окна заново', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        let clock = 0
        const registry = new Registry({ now: () => clock })
        registry.register({ uid: 1, name: 'Card', parentUid: null })
        watchBudgets(registry, resolveOptions({ enabled: true, budgets: { maxRenders: 2 } }))

        registry.record(event({ timestamp: 0 }))
        registry.record(event({ timestamp: 10 }))
        clock = 20
        registry.reset()
        registry.record(event({ timestamp: 30 }))
        expect(registry.getViolations()).toEqual([])
    })
})

describe('watchBudgets: длительность и прочее', () => {
    it('ловит долгое обновление, а монтирование не трогает', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        const { registry } = setup({ budgets: { maxDuration: 16 } })
        registry.record(event({ phase: 'mount', duration: 40 }))
        expect(registry.getViolations()).toEqual([])

        registry.record(event({
            duration: 24.5,
            reasons: [{ type: 'set', key: 'items', source: 'store' }],
        }))
        expect(registry.getViolations()[0]).toMatchObject({ kind: 'duration', limit: 16, actual: 24.5, reason: 'store items' })
    })

    it('зовёт колбэк на первое нарушение', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        const onBudgetExceeded = vi.fn()
        const { registry } = setup({ budgets: { maxDuration: 1 }, onBudgetExceeded })
        registry.record(event({ duration: 5 }))
        registry.record(event({ duration: 9 }))
        expect(onBudgetExceeded).toHaveBeenCalledTimes(1)
        expect(registry.getViolations()[0]).toMatchObject({ actual: 9, count: 2 })
    })

    it('бюджет без ограничений и кривые числа молча игнорирует', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const { registry } = setup({ budgets: [{}, { maxRenders: -1 }, { maxDuration: Number.NaN }] })
        for (const timestamp of [0, 1, 2]) registry.record(event({ timestamp, duration: 100 }))
        expect(registry.getViolations()).toEqual([])
        expect(warn).not.toHaveBeenCalled()
    })

    it('нарушения попадают в отчёт', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        const { registry, resolved } = setup({ budgets: { maxDuration: 1 } })
        registry.record(event({ duration: 5 }))
        expect(createReport({ registry, options: resolved }).violations).toHaveLength(1)
    })

    it('отписка останавливает проверку', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        const { registry, stop } = setup({ budgets: { maxDuration: 1 } })
        stop()
        registry.record(event({ duration: 5 }))
        expect(registry.getViolations()).toEqual([])
    })
})

describe('бюджеты в живом приложении и window.__VUE_WHY_RENDER__', () => {
    let app: App | null = null
    let handle: ScanHandle | null = null
    let host: HTMLElement | null = null

    afterEach(() => {
        handle?.stop()
        app?.unmount()
        host?.remove()
        app = null
        handle = null
        host = null
    })

    it('ловит частый рендер настоящего компонента и отдаёт его через window', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        const Counter = defineComponent({
            name: 'Counter',
            setup() {
                const count = ref(0)
                return { count, bump: () => count.value++ }
            },
            render() {
                return h('div', String(this.count))
            },
        })
        host = document.createElement('div')
        document.body.appendChild(host)
        app = createApp(Counter)
        handle = scan(app, { panel: false, overlay: false, devtools: false, budgets: { maxRenders: 2 } })!
        const vm = app.mount(host) as unknown as { bump: () => void }

        for (let i = 0; i < 3; i++) {
            vm.bump()
            await nextTick()
        }

        const exposed = window.__VUE_WHY_RENDER__!
        expect(exposed.getViolations()).toHaveLength(1)
        expect(exposed.getReport().violations?.[0].name).toBe('Counter')
    })

    it('stop снимает глобал', () => {
        app = createApp(defineComponent({ render: () => h('div') }))
        handle = scan(app, { panel: false, overlay: false, devtools: false })!
        expect(window.__VUE_WHY_RENDER__).toBeDefined()
        handle.stop()
        handle = null
        expect(window.__VUE_WHY_RENDER__).toBeUndefined()
    })
})
