import { describe, expect, it } from 'vitest'
import { Registry } from '../src/core/registry'
import { createReport, serializeReport, parseReport } from '../src/core/report'
import { registryFromReport } from '../src/core/import'
import { resolveOptions } from '../src/options'
import type { RenderEvent } from '../src/types'

function event(partial: Partial<RenderEvent> & Pick<RenderEvent, 'uid' | 'name'>): RenderEvent {
    return { phase: 'update', duration: 2, fps: 60, timestamp: 0, reasons: [], propChanges: [], ...partial }
}

export function sampleReport() {
    let clock = 1000
    const registry = new Registry({ now: () => clock })
    registry.register({ uid: 10, name: 'Card', file: '/app/src/Card.vue', parentUid: null })
    registry.register({ uid: 11, name: 'Card', file: '/app/src/Card.vue', parentUid: 10 })
    registry.register({ uid: 12, name: 'List', file: '/app/src/List.vue', parentUid: null })
    registry.record(event({ uid: 10, name: 'Card', file: '/app/src/Card.vue', reasons: [{ type: 'set', key: 'n', source: 'setup' }] }))
    registry.record(event({ uid: 11, name: 'Card', file: '/app/src/Card.vue', duration: 6 }))
    registry.record(event({ uid: 12, name: 'List', file: '/app/src/List.vue', phase: 'mount', duration: 0 }))
    registry.addViolation({ kind: 'duration', key: '/app/src/Card.vue::Card', name: 'Card', file: '/app/src/Card.vue', limit: 5, actual: 6, count: 1, firstAt: 0, lastAt: 0 })
    clock = 5000
    // Через JSON, как из файла: живых ссылок в отчёте быть не должно.
    return parseReport(serializeReport(createReport({ registry, options: resolveOptions({ enabled: true }), now: () => clock })))
}

describe('registryFromReport', () => {
    it('восстанавливает агрегаты, события, итоги и нарушения', () => {
        const report = sampleReport()
        const registry = registryFromReport(report)
        const snapshot = registry.snapshot()

        expect(snapshot.totalRenders).toBe(3)
        expect(snapshot.events).toHaveLength(3)
        expect(snapshot.startedAt).toBe(report.meta.startedAt)

        const card = registry.top(10).find(record => record.name === 'Card')!
        expect(card).toMatchObject({ renderCount: 2, updateCount: 2, totalDuration: 8, maxDuration: 6 })
        expect(card.lastReasons).toEqual([{ type: 'set', key: 'n', source: 'setup' }])
        expect(registry.hasViolation('/app/src/Card.vue::Card')).toBe(true)
    })

    it('дерево плоское: связей родитель — ребёнок в отчёте нет', () => {
        const tree = registryFromReport(sampleReport()).tree()
        expect(tree.every(node => node.depth === 0 && node.children.length === 0)).toBe(true)
    })

    it('отчёт без нарушений (до 0.5.0) открывается', () => {
        const report = sampleReport()
        delete report.violations
        expect(registryFromReport(report).getViolations()).toEqual([])
    })
})
