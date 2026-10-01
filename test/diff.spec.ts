import { describe, expect, it } from 'vitest'
import { diffReports, formatDiff } from '../src/core/diff'
import { REPORT_FORMAT } from '../src/core/report'
import type { Report, ReportComponent, ReportOptions } from '../src/core/report'

const baseOptions: ReportOptions = {
    includeMounts: false,
    trackReasons: true,
    trackProps: true,
    minDuration: 0,
    hotThreshold: 5,
    maxEvents: 500,
    include: [],
    exclude: [],
}

function component(name: string, renderCount: number, reasons: string[] = []): ReportComponent {
    return {
        key: `src/${name}.vue::${name}`,
        name,
        file: `src/${name}.vue`,
        instances: 1,
        renderCount,
        updateCount: renderCount,
        totalDuration: renderCount,
        maxDuration: 1,
        reasons: reasons.map(item => ({ type: 'set', key: item.split(':')[1]!, source: item.split(':')[0] as never })),
        propChanges: [],
        hints: [],
    }
}

function report(components: ReportComponent[], extra: Partial<Report['meta']> = {}): Report {
    const renders = components.reduce((sum, item) => sum + item.renderCount, 0)
    const durationMs = extra.durationMs ?? 10_000
    return {
        meta: {
            format: REPORT_FORMAT,
            package: '0.2.0',
            vue: '3.5.13',
            createdAt: 0,
            startedAt: 0,
            durationMs,
            options: baseOptions,
            ...extra,
        },
        totals: { renders, components: components.length, rendersPerSecond: renders / (durationMs / 1000) },
        components,
        events: [],
    }
}

describe('diffReports', () => {
    it('ловит улучшение и считает долю', () => {
        const diff = diffReports(
            report([component('ProductCard', 42)]),
            report([component('ProductCard', 7)]),
        )
        const card = diff.components[0]
        expect(card.status).toBe('improved')
        expect(card.delta).toBe(-35)
        expect(card.deltaRatio).toBeCloseTo(-0.833, 2)
    })

    it('регрессия идёт выше улучшения — её ищут, а не празднуют', () => {
        const diff = diffReports(
            report([component('Fixed', 40), component('Broken', 3)]),
            report([component('Fixed', 2), component('Broken', 19)]),
        )
        expect(diff.components.map(item => item.name)).toEqual(['Broken', 'Fixed'])
        expect(diff.components[0].status).toBe('regressed')
    })

    it('различает появившийся и исчезнувший компонент', () => {
        const diff = diffReports(
            report([component('Gone', 5)]),
            report([component('Fresh', 5)]),
        )
        const byName = Object.fromEntries(diff.components.map(item => [item.name, item.status]))
        expect(byName).toEqual({ Fresh: 'added', Gone: 'removed' })
    })

    it('называет ушедшие и новые причины', () => {
        const diff = diffReports(
            report([component('Card', 10, ['props:badge'])]),
            report([component('Card', 2, ['store:items'])]),
        )
        expect(diff.components[0].reasonsGone).toEqual(['props:badge'])
        expect(diff.components[0].reasonsNew).toEqual(['store:items'])
    })

    it('не делит на ноль, когда компонента раньше не было', () => {
        const diff = diffReports(report([]), report([component('Fresh', 4)]))
        expect(diff.components[0].deltaRatio).toBeNull()
    })

    it('сравнивает агрегаты по ключу, а не по порядку', () => {
        const diff = diffReports(
            report([component('A', 1), component('B', 9)]),
            report([component('B', 2), component('A', 1)]),
        )
        const b = diff.components.find(item => item.name === 'B')!
        expect(b.before).toBe(9)
        expect(b.after).toBe(2)
    })
})

describe('предупреждения о несопоставимости', () => {
    it('молчит, когда сессии сняты одинаково', () => {
        const diff = diffReports(report([component('A', 5)]), report([component('A', 3)]))
        expect(diff.warnings).toEqual([])
    })

    it('ругается на разную длительность — иначе «минус 80%» обман', () => {
        const diff = diffReports(
            report([component('A', 100)], { durationMs: 60_000 }),
            report([component('A', 20)], { durationMs: 10_000 }),
        )
        expect(diff.warnings.some(w => w.includes('differ in length'))).toBe(true)
        // А per-second показывает, что на самом деле стало хуже почти вдвое.
        expect(diff.components[0].beforePerSecond).toBeCloseTo(1.667, 2)
        expect(diff.components[0].afterPerSecond).toBeCloseTo(2, 2)
    })

    it('ругается на разные фильтры', () => {
        const diff = diffReports(
            report([component('A', 5)]),
            report([component('A', 1)], { options: { ...baseOptions, exclude: ['/^Router/'] } }),
        )
        expect(diff.warnings.some(w => w.includes('include/exclude differ'))).toBe(true)
    })

    it('порядок фильтров сам по себе не повод ругаться', () => {
        const diff = diffReports(
            report([component('A', 5)], { options: { ...baseOptions, exclude: ['a', 'b'] } }),
            report([component('A', 5)], { options: { ...baseOptions, exclude: ['b', 'a'] } }),
        )
        expect(diff.warnings).toEqual([])
    })

    it('ругается на includeMounts и minDuration', () => {
        const mounts = diffReports(
            report([component('A', 5)]),
            report([component('A', 5)], { options: { ...baseOptions, includeMounts: true } }),
        )
        expect(mounts.warnings.some(w => w.includes('includeMounts'))).toBe(true)

        const duration = diffReports(
            report([component('A', 5)]),
            report([component('A', 5)], { options: { ...baseOptions, minDuration: 4 } }),
        )
        expect(duration.warnings.some(w => w.includes('minDuration'))).toBe(true)
    })

    it('ругается на разные версии пакета', () => {
        const diff = diffReports(
            report([component('A', 5)]),
            report([component('A', 5)], { package: '0.3.0' }),
        )
        expect(diff.warnings.some(w => w.includes('different versions'))).toBe(true)
    })
})

describe('formatDiff', () => {
    it('ставит предупреждения первыми', () => {
        const diff = diffReports(
            report([component('A', 100)], { durationMs: 60_000 }),
            report([component('A', 20)], { durationMs: 10_000 }),
        )
        expect(formatDiff(diff)[0].startsWith('!')).toBe(true)
    })

    it('показывает итог и изменившиеся строки', () => {
        const diff = diffReports(
            report([component('ProductCard', 42, ['props:badge']), component('Stable', 3)]),
            report([component('ProductCard', 7), component('Stable', 3)]),
        )
        const text = formatDiff(diff).join('\n')
        expect(text).toContain('total ×45 → ×10')
        expect(text).toContain('ProductCard')
        expect(text).toContain('-83%')
        expect(text).toContain('reason gone: props:badge')
        // Неизменившиеся строки не шумят.
        expect(text).not.toContain('Stable')
    })

    it('честно сообщает, сколько строк спрятал', () => {
        const before = Array.from({ length: 10 }, (_, i) => component(`C${i}`, 10))
        const after = Array.from({ length: 10 }, (_, i) => component(`C${i}`, 1))
        const text = formatDiff(diffReports(report(before), report(after)), 3).join('\n')
        expect(text).toContain('… and 7 more')
    })

    it('не врёт, когда менять нечего', () => {
        const diff = diffReports(report([component('A', 5)]), report([component('A', 5)]))
        expect(formatDiff(diff)).toContain('nothing changed')
    })
})
