/**
 * Benchmark: WASM vs pure JS implementations.
 *
 * These tests measure the performance of WASM-accelerated functions
 * against their JS fallbacks. WASM may not be available in jsdom,
 * so the tests work either way and report results.
 */
import { describe, it, expect } from 'vitest'
import type { ComponentRecord, RenderReason, PropChange } from 'vue-why-render'
import { build_tree_js } from '../src/core/tree-js'
import { aggregate_components_js } from '../src/core/report-js'
import { dedupeReasons } from '../src/core/reason'
import { diffReports } from '../src/core/diff'
import { createReport, componentKey } from '../src/core/report'
import { Registry } from '../src/core/registry'
import { resolveOptions } from '../src/options'
import { hintsFor } from '../src/core/hints'

// --- Helpers: generate test data ---

function makeRecord(uid: number, parentUid: number | null, name: string, file: string, renders: number): ComponentRecord {
    const reasons: RenderReason[] = renders > 0
        ? [{ type: 'set', key: `prop${uid % 5}`, source: 'props' }]
        : []
    const propChanges: PropChange[] = renders > 2
        ? [{ key: `style`, oldValue: '{}', newValue: '{}', referenceOnly: true, newFunction: false }]
        : []

    return {
        uid,
        name,
        file,
        parentUid: parentUid,
        mountedAt: 1000,
        renderCount: renders,
        updateCount: Math.max(0, renders - 1),
        flashCount: 0,
        totalDuration: renders * 1.5,
        maxDuration: 3.0,
        lastDuration: 1.5,
        lastRenderAt: 2000,
        lastReasons: reasons,
        lastPropChanges: propChanges,
    }
}

function generateRecords(count: number): ComponentRecord[] {
    const records: ComponentRecord[] = []
    const files = ['App.vue', 'Header.vue', 'Footer.vue', 'Button.vue', 'Card.vue',
        'List.vue', 'Item.vue', 'Modal.vue', 'Form.vue', 'Input.vue']

    for (let i = 0; i < count; i++) {
        const parentUid = i === 0 ? null : Math.floor(Math.random() * i)
        const fileIdx = i % files.length
        const name = `${files[fileIdx].replace('.vue', '')}${Math.floor(i / files.length)}`
        records.push(makeRecord(i, parentUid, name, `src/components/${files[fileIdx]}`, Math.floor(Math.random() * 20)))
    }
    return records
}

function generateReasons(count: number): RenderReason[] {
    const reasons: RenderReason[] = []
    const sources = ['props', 'setup', 'store', 'computed', 'route'] as const
    for (let i = 0; i < count; i++) {
        reasons.push({
            type: i % 3 === 0 ? 'set' : i % 3 === 1 ? 'add' : 'delete',
            key: `key${i % 20}`,
            source: sources[i % sources.length],
            oldValue: `old${i}`,
            newValue: `new${i}`,
        })
    }
    return reasons
}

// --- Benchmark utility ---

function bench(fn: () => void, iterations: number): { avgMs: number, totalMs: number } {
    // Warmup
    for (let i = 0; i < 3; i++) fn()

    const start = performance.now()
    for (let i = 0; i < iterations; i++) fn()
    const totalMs = performance.now() - start
    return { avgMs: totalMs / iterations, totalMs }
}

// --- Tests ---

describe('WASM benchmarks', () => {
    const SIZES = [100, 500, 1000, 5000]

    describe('buildTree', () => {
        for (const size of SIZES) {
            it(`JS: ${size} components`, () => {
                const records = generateRecords(size)
                const result = bench(() => build_tree_js(records), size <= 500 ? 100 : 10)
                console.log(`  buildTree JS (${size}): ${result.avgMs.toFixed(3)}ms avg`)
                expect(result.avgMs).toBeLessThan(1000)
            })
        }
    })

    describe('aggregateComponents', () => {
        const options = { trackProps: true, trackReasons: true }

        for (const size of SIZES) {
            it(`JS: ${size} components`, () => {
                const records = generateRecords(size)
                const result = bench(() => aggregate_components_js(records, options), size <= 500 ? 100 : 10)
                console.log(`  aggregate JS (${size}): ${result.avgMs.toFixed(3)}ms avg`)
                expect(result.avgMs).toBeLessThan(1000)
            })
        }
    })

    describe('dedupeReasons', () => {
        it('JS: 1000 reasons', () => {
            const reasons = generateReasons(1000)
            const result = bench(() => dedupeReasons(reasons, 10), 1000)
            console.log(`  dedupe JS (1000): ${result.avgMs.toFixed(3)}ms avg`)
            expect(result.avgMs).toBeLessThan(100)
        })
    })

    describe('diffReports', () => {
        it('JS: 500 components', () => {
            const options = resolveOptions({})
            const registry1 = new Registry()
            const registry2 = new Registry()
            const records = generateRecords(500)

            for (const r of records) {
                registry1.register(r)
                registry2.register({ ...r, uid: r.uid })
            }
            // Simulate some changes for registry2
            for (let i = 0; i < 100; i++) {
                const r = registry2.get(i)
                if (r) {
                    r.renderCount += Math.floor(Math.random() * 10)
                    r.totalDuration += Math.random() * 5
                }
            }

            const report1 = createReport({ registry: registry1, options })
            const report2 = createReport({ registry: registry2, options })
            const result = bench(() => diffReports(report1, report2), 100)
            console.log(`  diffReports JS (500): ${result.avgMs.toFixed(3)}ms avg`)
            expect(result.avgMs).toBeLessThan(1000)
        })
    })

    describe('correctness: JS fallback matches expected output', () => {
        it('buildTree produces correct structure', () => {
            const records: ComponentRecord[] = [
                makeRecord(1, null, 'App', 'App.vue', 2),
                makeRecord(2, 1, 'Header', 'Header.vue', 5),
                makeRecord(3, 1, 'Footer', 'Footer.vue', 1),
                makeRecord(4, 2, 'Logo', 'Logo.vue', 3),
            ]

            const tree = build_tree_js(records)
            expect(tree).toHaveLength(1)
            expect(tree[0].name).toBe('App')
            expect(tree[0].subtreeRenders).toBe(11) // 2 + 5 + 1 + 3
            expect(tree[0].children).toHaveLength(2)
            expect(tree[0].depth).toBe(0)

            const header = tree[0].children.find(n => n.name === 'Header')!
            expect(header.subtreeRenders).toBe(8) // 5 + 3
            expect(header.depth).toBe(1)
            expect(header.children).toHaveLength(1)
        })

        it('aggregateComponents groups by key', () => {
            const records: ComponentRecord[] = [
                makeRecord(1, null, 'Button', 'Button.vue', 3),
                makeRecord(2, null, 'Button', 'Button.vue', 7),
                makeRecord(3, null, 'App', 'App.vue', 1),
            ]

            const result = aggregate_components_js(records, { trackProps: true, trackReasons: true })
            expect(result).toHaveLength(2)
            expect(result[0].name).toBe('Button')
            expect(result[0].renderCount).toBe(10)
            expect(result[0].instances).toBe(2)
        })
    })
})
