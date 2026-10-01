import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { Registry } from '../src/core/registry'
import {
    REPORT_FORMAT,
    ReportParseError,
    componentKey,
    createReport,
    describeFilter,
    parseReport,
    serializeReport,
} from '../src/core/report'
import { resolveOptions } from '../src/options'
import { VERSION } from '../src/version'
import type { RenderEvent } from '../src/types'

function event(partial: Partial<RenderEvent> & Pick<RenderEvent, 'uid' | 'name'>): RenderEvent {
    return {
        phase: 'update',
        duration: 1,
        fps: 60,
        timestamp: 1000,
        reasons: [],
        propChanges: [],
        ...partial,
    }
}

function filledRegistry(): Registry {
    let clock = 1000
    const registry = new Registry({ now: () => clock })

    registry.register({ uid: 1, name: 'ProductCard', file: 'src/ProductCard.vue', parentUid: null })
    registry.register({ uid: 2, name: 'ProductCard', file: 'src/ProductCard.vue', parentUid: null })
    registry.register({ uid: 3, name: 'CartSummary', file: 'src/CartSummary.vue', parentUid: null })

    registry.record(event({
        uid: 1,
        name: 'ProductCard',
        file: 'src/ProductCard.vue',
        duration: 2,
        reasons: [{ type: 'set', key: 'badge', source: 'props' }],
    }))
    registry.record(event({
        uid: 2,
        name: 'ProductCard',
        file: 'src/ProductCard.vue',
        duration: 4,
        reasons: [{ type: 'set', key: 'badge', source: 'props' }],
    }))
    registry.record(event({ uid: 3, name: 'CartSummary', file: 'src/CartSummary.vue', duration: 1 }))

    clock = 5000
    return registry
}

describe('componentKey', () => {
    it('склеивает файл и имя — uid между сессиями бессмыслен', () => {
        expect(componentKey({ name: 'Card', file: 'src/Card.vue' })).toBe('src/Card.vue::Card')
    })

    it('без файла остаётся одно имя', () => {
        expect(componentKey({ name: 'Anonymous' })).toBe('Anonymous')
    })
})

describe('describeFilter', () => {
    it('сохраняет регулярку читаемой', () => {
        expect(describeFilter(/^Router/i)).toBe('/^Router/i')
    })

    it('функцию сводит к имени — тело в отчёте бесполезно', () => {
        expect(describeFilter(function onlyCart() { return true })).toBe('fn:onlyCart')
        expect(describeFilter(() => true)).toMatch(/^fn:/)
    })

    it('строку оставляет как есть', () => {
        expect(describeFilter('ProductCard')).toBe('ProductCard')
    })
})

describe('createReport', () => {
    it('сводит инстансы одного компонента в агрегат', () => {
        const report = createReport({
            registry: filledRegistry(),
            options: resolveOptions(),
            now: () => 5000,
        })

        const card = report.components.find(item => item.name === 'ProductCard')
        expect(card).toBeDefined()
        expect(card!.instances).toBe(2)
        expect(card!.renderCount).toBe(2)
        expect(card!.totalDuration).toBe(6)
        expect(card!.maxDuration).toBe(4)
    })

    it('не дублирует одинаковые причины у разных инстансов', () => {
        const report = createReport({ registry: filledRegistry(), options: resolveOptions(), now: () => 5000 })
        const card = report.components.find(item => item.name === 'ProductCard')!
        expect(card.reasons).toHaveLength(1)
        expect(card.reasons[0].key).toBe('badge')
    })

    it('пишет метаданные, без которых чужой отчёт нечитаем', () => {
        const report = createReport({
            registry: filledRegistry(),
            options: resolveOptions({ exclude: [/^Router/], minDuration: 2 }),
            now: () => 5000,
            url: 'http://localhost:3000/',
            userAgent: 'test-agent',
        })

        expect(report.meta.format).toBe(REPORT_FORMAT)
        expect(report.meta.package).toBe(VERSION)
        expect(report.meta.vue).toMatch(/^3\./)
        expect(report.meta.url).toBe('http://localhost:3000/')
        expect(report.meta.userAgent).toBe('test-agent')
        expect(report.meta.durationMs).toBe(4000)
        expect(report.meta.options.exclude).toEqual(['/^Router/'])
        expect(report.meta.options.minDuration).toBe(2)
    })

    it('считает рендеры в секунду', () => {
        const report = createReport({ registry: filledRegistry(), options: resolveOptions(), now: () => 5000 })
        // 3 рендера за 4 секунды
        expect(report.totals.renders).toBe(3)
        expect(report.totals.rendersPerSecond).toBeCloseTo(0.75, 5)
    })

    it('сортирует компоненты по числу рендеров', () => {
        const report = createReport({ registry: filledRegistry(), options: resolveOptions(), now: () => 5000 })
        expect(report.components[0].name).toBe('ProductCard')
    })

    it('отчёт переживает JSON без потерь', () => {
        const report = createReport({ registry: filledRegistry(), options: resolveOptions(), now: () => 5000 })
        const restored = parseReport(serializeReport(report))
        expect(restored).toEqual(report)
    })
})

describe('parseReport', () => {
    it('не глотает мусор', () => {
        expect(() => parseReport('{ not json')).toThrow(ReportParseError)
        expect(() => parseReport('null')).toThrow(/must be an object/)
        expect(() => parseReport('{}')).toThrow(/no meta/)
        expect(() => parseReport('{"meta":{}}')).toThrow(/no format version/)
        expect(() => parseReport('{"meta":{"format":1}}')).toThrow(/no components/)
        expect(() => parseReport('{"meta":{"format":1},"components":[]}')).toThrow(/no events/)
    })

    it('отказывается читать формат из будущего, а не делает вид, что понял', () => {
        const future = JSON.stringify({ meta: { format: REPORT_FORMAT + 1 }, components: [], events: [] })
        expect(() => parseReport(future)).toThrow(/newer than supported/)
    })

    it('принимает уже разобранный объект', () => {
        const report = createReport({ registry: filledRegistry(), options: resolveOptions(), now: () => 5000 })
        expect(parseReport(JSON.parse(serializeReport(report)))).toEqual(report)
    })
})

describe('версия в рантайме', () => {
    it('совпадает с package.json — иначе отчёты уедут с неверной меткой', () => {
        // В jsdom import.meta.url — http-адрес, поэтому от корня процесса.
        const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'))
        expect(VERSION).toBe(pkg.version)
    })
})

describe('downloadReport', () => {
    it('кладёт файл с отметкой времени в имени', async () => {
        const { downloadReport } = await import('../src/core/report')
        const report = createReport({ registry: filledRegistry(), options: resolveOptions(), now: () => 5000 })

        const createObjectURL = vi.fn(() => 'blob:fake')
        const revokeObjectURL = vi.fn()
        vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })

        const click = vi.fn()
        const realCreate = document.createElement.bind(document)
        let anchor: HTMLAnchorElement | null = null
        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            const el = realCreate(tag)
            if (tag === 'a') {
                anchor = el as HTMLAnchorElement
                el.click = click
            }
            return el
        })

        downloadReport(report)

        expect(click).toHaveBeenCalledOnce()
        expect(anchor!.download).toMatch(/^vue-why-render-.*\.json$/)
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake')

        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })
})
