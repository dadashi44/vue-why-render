import { describe, expect, it } from 'vitest'
import { Registry } from '../src/core/registry'
import { createReport } from '../src/core/report'
import { formatReportMarkdown } from '../src/core/markdown'
import { resolveOptions } from '../src/options'
import type { RenderEvent, VueWhyRenderOptions } from '../src/types'

function event(partial: Partial<RenderEvent> & Pick<RenderEvent, 'uid' | 'name'>): RenderEvent {
    return { phase: 'update', duration: 1, fps: 60, timestamp: 1000, reasons: [], propChanges: [], ...partial }
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
    clock = 10_000
    return createReport({
        registry,
        options: resolveOptions({ enabled: true, ...options }),
        now: () => clock,
        url: 'https://internal.example/admin?token=secret',
        userAgent: 'test',
    })
}

const badge = {
    key: 'badge', oldValue: '{ text }', newValue: '{ text }', referenceOnly: true, newFunction: false,
}

describe('formatReportMarkdown', () => {
    it('собирает шапку и таблицы', () => {
        const report = build([
            event({ uid: 1, name: 'ProductCard', file: '/app/src/components/ProductCard.vue', duration: 2, propChanges: [badge] }),
            event({ uid: 1, name: 'ProductCard', file: '/app/src/components/ProductCard.vue', duration: 4, propChanges: [badge] }),
            event({ uid: 2, name: 'CartSummary', duration: 1, reasons: [{ type: 'set', key: 'items', source: 'store' }] }),
        ])
        const md = formatReportMarkdown(report)

        expect(md).toContain('### vue-why-render report')
        expect(md).toContain('3 renders (0.3/s) · 2 components')
        expect(md).toContain('Options: defaults')
        expect(md).toContain('| `ProductCard` `components/ProductCard.vue` | 2 | 0.2 | 3.0ms | `prop badge: { text } → { text } — new reference, same value` |')
        expect(md).toContain('#### Slowest')
        expect(md).toContain('#### Most frequent reasons (last 3 renders)')
        expect(md).toContain('| `prop badge — new reference, same value` | 2 | `ProductCard` |')
        expect(md).toContain('| `store items` | 1 | `CartSummary` |')
        expect(md).toContain('- `ProductCard`: badge: looks like this object is rebuilt')
    })

    it('число инстансов пишет словами, чтобы не спутать с рендерами', () => {
        const md = formatReportMarkdown(build([
            event({ uid: 1, name: 'Row', file: '/app/src/Row.vue' }),
            event({ uid: 2, name: 'Row', file: '/app/src/Row.vue' }),
        ]))
        expect(md).toContain('| `Row` `src/Row.vue` · 2 instances | 2 |')
    })

    it('не выносит URL страницы в публичный текст', () => {
        const md = formatReportMarkdown(build([event({ uid: 1, name: 'A' })]))
        expect(md).not.toContain('internal.example')
        expect(md).not.toContain('secret')
    })

    it('экранирует то, что сломало бы таблицу или стало разметкой', () => {
        const md = formatReportMarkdown(build([event({
            uid: 1,
            name: 'A',
            reasons: [{ type: 'set', key: 'html', source: 'setup', oldValue: '"a|b"', newValue: '"<b>`x`</b>\nnext"' }],
        })]))
        expect(md).toContain('`` state html: "a\\|b" → "<b>`x`</b> next" ``')
        // Ни одна строка таблицы не разъехалась на две.
        expect(md.split('\n').filter(line => line.includes('html')).length).toBe(2)
    })

    it('называет опции, отличные от умолчаний', () => {
        const md = formatReportMarkdown(build([event({ uid: 1, name: 'A' })], {
            includeMounts: true, minDuration: 2, include: [/^Product/],
        }))
        expect(md).toContain('Options: `includeMounts`, `minDuration: 2`, include `/^Product/`')
    })

    it('предупреждает, что счётчики выборочные', () => {
        const md = formatReportMarkdown(build([event({ uid: 1, name: 'A' })], { sampleRate: 0.1 }))
        expect(md).toContain('> Sampled: only 10% of renders were recorded')
    })

    it('пустая сессия — одна строка вместо пустых таблиц', () => {
        const md = formatReportMarkdown(build([]))
        expect(md).toContain('No renders recorded.')
        expect(md).not.toContain('####')
    })

    it('режет таблицы по limit', () => {
        const events = Array.from({ length: 5 }, (_, index) => event({ uid: index + 1, name: `C${index}` }))
        const md = formatReportMarkdown(build(events), { limit: 2 })
        const rows = md.split('#### Slowest')[0].split('\n').filter(line => line.startsWith('| `C'))
        expect(rows).toHaveLength(2)
    })

    it('одну причину в одном рендере считает один раз', () => {
        const md = formatReportMarkdown(build([event({
            uid: 1,
            name: 'A',
            // Проп приходит дважды — из renderTriggered и из дифа. Это один рендер.
            reasons: [{ type: 'set', key: 'badge', source: 'props' }],
            propChanges: [badge],
        })]))
        expect(md).toContain('| `prop badge — new reference, same value` | 1 | `A` |')
        expect(md).not.toContain('`prop badge` |')
    })
})
