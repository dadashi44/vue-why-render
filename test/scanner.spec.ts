import { afterEach, describe, expect, it, vi } from 'vitest'
import type { App } from 'vue'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { getScanHandle, scan } from '../src/index'
import type { ScanHandle } from '../src/index'
import type { VueWhyRenderOptions } from '../src/types'

let app: App | null = null
let handle: ScanHandle | null = null
let host: HTMLElement | null = null

/** Интеграционный стенд: настоящее приложение Vue в jsdom. */
function start(root: ReturnType<typeof defineComponent>, options: VueWhyRenderOptions = {}) {
    host = document.createElement('div')
    document.body.appendChild(host)

    app = createApp(root)
    handle = scan(app, { panel: false, overlay: false, ...options })
    const vm = app.mount(host)
    return { handle, vm }
}

afterEach(() => {
    handle?.stop()
    app?.unmount()
    host?.remove()
    app = null
    handle = null
    host = null
})

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

describe('scan', () => {
    it('возвращает null и не трогает приложение, когда выключен', () => {
        const { handle: disabled } = start(Counter, { enabled: false })
        expect(disabled).toBeNull()
        expect(getScanHandle()).toBeNull()
    })

    it('регистрирует смонтированные компоненты', () => {
        const { handle: active } = start(Counter)
        expect(active!.getStats().map(record => record.name)).toContain('Counter')
    })

    it('пишет обновление с длительностью', async () => {
        const { handle: active, vm } = start(Counter)

        ;(vm as unknown as { bump: () => void }).bump()
        await nextTick()

        const events = active!.getEvents()
        expect(events).toHaveLength(1)
        expect(events[0]).toMatchObject({ name: 'Counter', phase: 'update' })
        expect(events[0].duration).toBeGreaterThanOrEqual(0)
    })

    it('называет реф, который вызвал перерисовку', async () => {
        const { handle: active, vm } = start(Counter)

        ;(vm as unknown as { bump: () => void }).bump()
        await nextTick()

        const [event] = active!.getEvents()
        expect(event.reasons).toHaveLength(1)
        expect(event.reasons[0]).toMatchObject({ source: 'setup', key: 'count', type: 'set' })
        expect(event.reasons[0].oldValue).toBe('0')
        expect(event.reasons[0].newValue).toBe('1')
    })

    it('не собирает причины при trackReasons: false', async () => {
        const { handle: active, vm } = start(Counter, { trackReasons: false })

        ;(vm as unknown as { bump: () => void }).bump()
        await nextTick()

        expect(active!.getEvents()[0].reasons).toEqual([])
    })

    it('находит изменившийся проп у ребёнка', async () => {
        const Child = defineComponent({
            name: 'Child',
            props: { title: { type: String, default: '' } },
            render() {
                return h('span', this.title)
            },
        })
        const Parent = defineComponent({
            name: 'Parent',
            setup() {
                const title = ref('a')
                return { title, rename: () => (title.value = 'b') }
            },
            render() {
                return h(Child, { title: this.title })
            },
        })

        const { handle: active, vm } = start(Parent)
        ;(vm as unknown as { rename: () => void }).rename()
        await nextTick()

        const childEvent = active!.getEvents().find(event => event.name === 'Child')
        expect(childEvent).toBeDefined()
        expect(childEvent!.propChanges).toEqual([
            { key: 'title', oldValue: '"a"', newValue: '"b"', referenceOnly: false },
        ])
    })

    it('связывает ребёнка с родителем в дереве', async () => {
        const Child = defineComponent({ name: 'Child', render: () => h('span', 'child') })
        const Parent = defineComponent({ name: 'Parent', render: () => h(Child) })

        const { handle: active } = start(Parent)
        const stats = active!.getStats()
        const parent = stats.find(record => record.name === 'Parent')!
        const child = stats.find(record => record.name === 'Child')!
        expect(child.parentUid).toBe(parent.uid)
    })

    it('не следит за исключёнными компонентами', async () => {
        const { handle: active, vm } = start(Counter, { exclude: ['Counter'] })

        ;(vm as unknown as { bump: () => void }).bump()
        await nextTick()

        expect(active!.getStats()).toHaveLength(0)
        expect(active!.getEvents()).toHaveLength(0)
    })

    it('пишет монтирования при includeMounts', () => {
        const { handle: active } = start(Counter, { includeMounts: true })
        const mounts = active!.getEvents().filter(event => event.phase === 'mount')
        expect(mounts.length).toBeGreaterThan(0)
    })

    it('по умолчанию монтирования не пишет', () => {
        const { handle: active } = start(Counter)
        expect(active!.getEvents()).toHaveLength(0)
    })

    it('отсекает обновления быстрее minDuration', async () => {
        const { handle: active, vm } = start(Counter, { minDuration: 10_000 })

        ;(vm as unknown as { bump: () => void }).bump()
        await nextTick()

        expect(active!.getEvents()).toHaveLength(0)
    })

    it('зовёт onRender на каждое событие', async () => {
        const onRender = vi.fn()
        const { vm } = start(Counter, { onRender })

        ;(vm as unknown as { bump: () => void }).bump()
        await nextTick()

        expect(onRender).toHaveBeenCalledTimes(1)
        expect(onRender.mock.calls[0][0]).toMatchObject({ name: 'Counter' })
    })

    it('убирает компонент из статистики после размонтирования', async () => {
        const Toggle = defineComponent({
            name: 'Toggle',
            setup() {
                const shown = ref(true)
                return { shown, hide: () => (shown.value = false) }
            },
            render() {
                return this.shown ? h(defineComponent({ name: 'Inner', render: () => h('i') })) : null
            },
        })

        const { handle: active, vm } = start(Toggle)
        expect(active!.getStats().some(record => record.name === 'Inner')).toBe(true)

        ;(vm as unknown as { hide: () => void }).hide()
        await nextTick()

        expect(active!.getStats().some(record => record.name === 'Inner')).toBe(false)
    })

    it('на паузе перестаёт писать и возобновляет после resume', async () => {
        const { handle: active, vm } = start(Counter)
        const bump = (vm as unknown as { bump: () => void }).bump

        active!.pause()
        bump()
        await nextTick()
        expect(active!.getEvents()).toHaveLength(0)

        active!.resume()
        bump()
        await nextTick()
        expect(active!.getEvents()).toHaveLength(1)
    })

    it('после stop новые рендеры не пишутся', async () => {
        const { handle: active, vm } = start(Counter)
        const bump = (vm as unknown as { bump: () => void }).bump

        active!.stop()
        bump()
        await nextTick()
        expect(active!.getEvents()).toHaveLength(0)
    })

    it('reset обнуляет статистику', async () => {
        const { handle: active, vm } = start(Counter)

        ;(vm as unknown as { bump: () => void }).bump()
        await nextTick()
        active!.reset()

        expect(active!.getEvents()).toHaveLength(0)
        expect(active!.getStats().every(record => record.renderCount === 0)).toBe(true)
    })
})
