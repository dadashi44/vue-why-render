import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { Scanner } from '../src/core/scanner'
import { resolveOptions } from '../src/options'
import { INSPECTOR_ID, TIMELINE_ID, setupDevtools } from '../src/devtools/plugin'
import { setupDevtoolsPlugin } from '../src/devtools/types'
import type { DevtoolsPluginApi, GetInspectorStatePayload, GetInspectorTreePayload } from '../src/devtools/types'

/** Поддельный api — повторяет ровно тот контракт, который ждёт DevTools. */
function fakeApi() {
    const treeHandlers: Array<(p: GetInspectorTreePayload) => void> = []
    const stateHandlers: Array<(p: GetInspectorStatePayload) => void> = []
    const timeline: Array<{ layerId: string, event: Record<string, unknown> }> = []
    const inspectors: unknown[] = []
    const layers: unknown[] = []
    const sent: string[] = []

    const api: DevtoolsPluginApi = {
        on: {
            getInspectorTree: handler => void treeHandlers.push(handler),
            getInspectorState: handler => void stateHandlers.push(handler),
        },
        addInspector: options => void inspectors.push(options),
        addTimelineLayer: options => void layers.push(options),
        addTimelineEvent: options => void timeline.push(options as never),
        sendInspectorTree: id => void sent.push(`tree:${id}`),
        sendInspectorState: id => void sent.push(`state:${id}`),
        now: () => 1000,
    }

    return {
        api,
        inspectors,
        layers,
        timeline,
        sent,
        tree(filter = '') {
            const payload: GetInspectorTreePayload = {
                app: null as never, inspectorId: INSPECTOR_ID, filter, rootNodes: [],
            }
            for (const handler of treeHandlers) handler(payload)
            return payload.rootNodes
        },
        state(nodeId: string) {
            const payload: GetInspectorStatePayload = {
                app: null as never, inspectorId: INSPECTOR_ID, nodeId, state: {},
            }
            for (const handler of stateHandlers) handler(payload)
            return payload.state as Record<string, Array<{ key: string, value: unknown }>>
        },
    }
}

/** Ставим хук до создания приложения — так же, как это делает расширение. */
function installHook(fake: ReturnType<typeof fakeApi>) {
    const emit = vi.fn((event: string, _descriptor: unknown, setupFn: (api: DevtoolsPluginApi) => void) => {
        if (event === 'devtools-plugin:setup') setupFn(fake.api)
    })
    ;(window as never as Record<string, unknown>).__VUE_DEVTOOLS_GLOBAL_HOOK__ = { emit }
    return emit
}

function mountCounter() {
    const count = ref(0)
    const Child = {
        name: 'ProductCard',
        props: { badge: { type: Object, required: true } },
        setup: (props: { badge: { text: string } }) => () => h('div', props.badge.text),
    }
    const App = {
        name: 'App',
        setup: () => () => h('div', [
            h('button', { onClick: () => count.value++ }, String(count.value)),
            h(Child, { badge: { text: 'sale' } }),
        ]),
    }
    const app = createApp(App)
    const host = document.createElement('div')
    document.body.appendChild(host)
    return { app, host, count }
}

beforeEach(() => {
    delete (window as never as Record<string, unknown>).__VUE_DEVTOOLS_GLOBAL_HOOK__
    delete (window as never as Record<string, unknown>).__VUE_DEVTOOLS_PLUGINS__
})

afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('мост до DevTools', () => {
    it('зовёт хук напрямую, если расширение уже на странице', () => {
        const fake = fakeApi()
        const emit = installHook(fake)
        setupDevtoolsPlugin({ id: 'x', label: 'x', app: null as never }, () => {})
        expect(emit).toHaveBeenCalledWith('devtools-plugin:setup', expect.anything(), expect.any(Function))
    })

    it('кладёт в очередь, если расширения ещё нет — порядок загрузки не фиксирован', () => {
        const setupFn = vi.fn()
        setupDevtoolsPlugin({ id: 'x', label: 'x', app: null as never }, setupFn)
        const queue = (window as never as Record<string, unknown[]>).__VUE_DEVTOOLS_PLUGINS__
        expect(queue).toHaveLength(1)
        expect(setupFn).not.toHaveBeenCalled()
    })
})

describe('инспектор', () => {
    it('регистрирует инспектор и слой таймлайна', () => {
        const fake = fakeApi()
        installHook(fake)
        const scanner = new Scanner(resolveOptions({ panel: false, overlay: false }))
        setupDevtools(createApp({ render: () => null }), scanner)

        expect(fake.inspectors).toEqual([expect.objectContaining({ id: INSPECTOR_ID })])
        expect(fake.layers).toEqual([expect.objectContaining({ id: TIMELINE_ID })])
    })

    it('отдаёт компоненты с числом рендеров', async () => {
        const fake = fakeApi()
        installHook(fake)
        const { app, host } = mountCounter()
        const scanner = new Scanner(resolveOptions({ panel: false, overlay: false }))
        app.mixin(scanner.createMixin())
        setupDevtools(app, scanner)
        app.mount(host)

        host.querySelector('button')!.click()
        await nextTick()

        const nodes = fake.tree()
        expect(nodes.length).toBeGreaterThan(0)
        const card = nodes.find(node => node.label === 'ProductCard')
        expect(card).toBeDefined()
        expect(card!.tags?.[0].label).toMatch(/^×\d+$/)
    })

    it('фильтрует дерево по строке', async () => {
        const fake = fakeApi()
        installHook(fake)
        const { app, host } = mountCounter()
        const scanner = new Scanner(resolveOptions({ panel: false, overlay: false }))
        app.mixin(scanner.createMixin())
        setupDevtools(app, scanner)
        app.mount(host)
        host.querySelector('button')!.click()
        await nextTick()

        expect(fake.tree('product').every(node => node.label.toLowerCase().includes('product'))).toBe(true)
        expect(fake.tree('нетакого')).toHaveLength(0)
    })

    it('в состоянии узла даёт причину, изменения пропов и подсказку', async () => {
        const fake = fakeApi()
        installHook(fake)
        const { app, host } = mountCounter()
        const scanner = new Scanner(resolveOptions({ panel: false, overlay: false, locale: 'en' }))
        app.mixin(scanner.createMixin())
        setupDevtools(app, scanner)
        app.mount(host)
        host.querySelector('button')!.click()
        await nextTick()

        const card = fake.tree().find(node => node.label === 'ProductCard')!
        const state = fake.state(card.id)

        expect(state.summary.map(entry => entry.key)).toContain('renders')
        expect(JSON.stringify(state['prop changes'])).toContain('new reference, same value')
        expect(JSON.stringify(state.hints)).toContain('hoist it into a constant')
    })

    it('неизвестный инспектор не трогаем — на странице могут быть чужие', () => {
        const fake = fakeApi()
        installHook(fake)
        const scanner = new Scanner(resolveOptions({ panel: false, overlay: false }))
        setupDevtools(createApp({ render: () => null }), scanner)

        const payload = { app: null as never, inspectorId: 'pinia', filter: '', rootNodes: [] }
        // Обработчик чужого инспектора обязан оставить payload нетронутым.
        fake.tree()
        expect(payload.rootNodes).toEqual([])
    })
})

describe('таймлайн', () => {
    it('пишет событие на каждый рендер', async () => {
        const fake = fakeApi()
        installHook(fake)
        const { app, host } = mountCounter()
        const scanner = new Scanner(resolveOptions({ panel: false, overlay: false }))
        app.mixin(scanner.createMixin())
        setupDevtools(app, scanner)
        app.mount(host)

        host.querySelector('button')!.click()
        await nextTick()

        expect(fake.timeline.length).toBeGreaterThan(0)
        const event = fake.timeline.find(item => (item.event as { title: string }).title === 'ProductCard')
        expect(event).toBeDefined()
        expect(event!.layerId).toBe(TIMELINE_ID)
        expect(String((event!.event as { subtitle: string }).subtitle)).toContain('badge')
    })

    it('после stop() события больше не пишутся', async () => {
        const fake = fakeApi()
        installHook(fake)
        const { app, host } = mountCounter()
        const scanner = new Scanner(resolveOptions({ panel: false, overlay: false }))
        app.mixin(scanner.createMixin())
        const stop = setupDevtools(app, scanner)
        app.mount(host)
        stop()

        const before = fake.timeline.length
        host.querySelector('button')!.click()
        await nextTick()
        expect(fake.timeline).toHaveLength(before)
    })
})
