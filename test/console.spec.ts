import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import { Registry } from '../src/core/registry'
import { createReport } from '../src/core/report'
import { printReport, reportRows } from '../src/core/console'
import { printReport as printLive, scan } from '../src/index'
import type { ScanHandle } from '../src/index'
import { resolveOptions } from '../src/options'
import type { RenderEvent, VueWhyRenderOptions } from '../src/types'

function event(partial: Partial<RenderEvent> & Pick<RenderEvent, 'uid' | 'name'>): RenderEvent {
    return { phase: 'update', duration: 2, fps: 60, timestamp: 0, reasons: [], propChanges: [], ...partial }
}

function build(events: RenderEvent[], options: VueWhyRenderOptions = {}) {
    let clock = 0
    const registry = new Registry({ now: () => clock })
    const seen = new Set<number>()
    for (const item of events) {
        if (!seen.has(item.uid)) {
            seen.add(item.uid)
            registry.register({ uid: item.uid, name: item.name, file: item.file, parentUid: null })
        }
        registry.record(item)
    }
    clock = 4000
    return createReport({ registry, options: resolveOptions({ enabled: true, ...options }), now: () => clock })
}

afterEach(() => {
    vi.restoreAllMocks()
})

describe('reportRows', () => {
    it('строка на компонент с причиной и частотой', () => {
        const rows = reportRows(build([
            event({ uid: 1, name: 'Card', file: '/app/src/ui/Card.vue', reasons: [{ type: 'set', key: 'n', source: 'setup', oldValue: '0', newValue: '1' }] }),
            event({ uid: 2, name: 'Card', file: '/app/src/ui/Card.vue' }),
        ]))
        expect(rows).toEqual([{
            component: 'Card (2)',
            file: 'ui/Card.vue',
            renders: 2,
            perSecond: 0.5,
            avg: '2.0ms',
            reason: 'state n: 0 → 1',
        }])
    })

    it('уважает limit', () => {
        const events = Array.from({ length: 5 }, (_, index) => event({ uid: index + 1, name: `C${index}` }))
        expect(reportRows(build(events), { limit: 3 })).toHaveLength(3)
    })
})

describe('printReport', () => {
    function spyConsole() {
        return {
            group: vi.spyOn(console, 'group').mockImplementation(() => {}),
            groupCollapsed: vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {}),
            groupEnd: vi.spyOn(console, 'groupEnd').mockImplementation(() => {}),
            table: vi.spyOn(console, 'table').mockImplementation(() => {}),
            log: vi.spyOn(console, 'log').mockImplementation(() => {}),
            warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
        }
    }

    it('печатает сводку, таблицу и подсказки, закрывая все группы', () => {
        const spies = spyConsole()
        printReport(build([event({
            uid: 1,
            name: 'Card',
            propChanges: [{ key: 'badge', oldValue: '{}', newValue: '{}', referenceOnly: true, newFunction: false }],
        })], { sampleRate: 0.5 }))

        expect(spies.group.mock.calls[0][0]).toBe('[vue-why-render] 1 renders in 4.0 s (0.3/s) · 1 components · sampled 50%')
        expect(spies.table).toHaveBeenCalledTimes(1)
        expect(spies.groupCollapsed).toHaveBeenCalledWith('hints (1)')
        expect(spies.log.mock.calls[0][0]).toContain('Card: badge: looks like this object is rebuilt')
        expect(spies.groupEnd).toHaveBeenCalledTimes(spies.group.mock.calls.length + spies.groupCollapsed.mock.calls.length)
    })

    it('пустую сессию печатает строкой, а не пустой таблицей', () => {
        const spies = spyConsole()
        printReport(build([]))
        expect(spies.table).not.toHaveBeenCalled()
        expect(spies.log).toHaveBeenCalledWith('No renders recorded.')
    })

    describe('из index — живая сессия', () => {
        let handle: ScanHandle | null = null

        afterEach(() => {
            handle?.stop()
            handle = null
        })

        it('без аргумента печатает текущий сканер', () => {
            const spies = spyConsole()
            handle = scan(createApp(defineComponent({ render: () => h('div') })), { panel: false, overlay: false, devtools: false })
            printLive()
            expect(spies.group).toHaveBeenCalledTimes(1)
        })

        it('без сканера и без отчёта предупреждает, а не падает', () => {
            const spies = spyConsole()
            printLive()
            expect(spies.warn).toHaveBeenCalledWith(expect.stringContaining('printReport'))
            expect(spies.group).not.toHaveBeenCalled()
        })
    })
})
