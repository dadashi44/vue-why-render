import { describe, expect, it, vi } from 'vitest'
import { defaultOptions, resolveOptions, shouldTrack } from '../src/options'

describe('resolveOptions', () => {
    it('подставляет дефолты', () => {
        const options = resolveOptions()
        expect(options.overlay).toBe(defaultOptions.overlay)
        expect(options.trackReasons).toBe(true)
        expect(options.maxEvents).toBe(500)
    })

    it('не затирает переданные значения', () => {
        const onRender = vi.fn()
        const options = resolveOptions({ overlay: false, maxEvents: 10, onRender })
        expect(options.overlay).toBe(false)
        expect(options.maxEvents).toBe(10)
        expect(options.onRender).toBe(onRender)
    })

    it('игнорирует явные undefined вместо того, чтобы стирать дефолт', () => {
        const options = resolveOptions({ overlay: undefined, panel: undefined })
        expect(options.overlay).toBe(true)
        expect(options.panel).toBe(true)
    })

    it('чинит невалидные числа', () => {
        const options = resolveOptions({
            maxEvents: -5,
            flushInterval: -1,
            displayDuration: -100,
            hotThreshold: 0,
            minDuration: -3,
        })
        expect(options.maxEvents).toBe(1)
        expect(options.flushInterval).toBe(0)
        expect(options.displayDuration).toBe(0)
        expect(options.hotThreshold).toBe(1)
        expect(options.minDuration).toBe(0)
    })

    it('включается по флагу enabled явно', () => {
        expect(resolveOptions({ enabled: false }).enabled).toBe(false)
        expect(resolveOptions({ enabled: true }).enabled).toBe(true)
    })
})

describe('shouldTrack', () => {
    const base = resolveOptions()

    it('пропускает всё, если фильтров нет', () => {
        expect(shouldTrack('Button', base)).toBe(true)
    })

    it('отсекает по строке', () => {
        const options = resolveOptions({ exclude: ['RouterLink'] })
        expect(shouldTrack('RouterLink', options)).toBe(false)
        expect(shouldTrack('Button', options)).toBe(true)
    })

    it('отсекает по регулярке', () => {
        const options = resolveOptions({ exclude: [/^El/] })
        expect(shouldTrack('ElButton', options)).toBe(false)
        expect(shouldTrack('Button', options)).toBe(true)
    })

    it('не залипает на lastIndex у регулярки с флагом g', () => {
        const options = resolveOptions({ exclude: [/Item/g] })
        expect(shouldTrack('ListItem', options)).toBe(false)
        expect(shouldTrack('ListItem', options)).toBe(false)
        expect(shouldTrack('ListItem', options)).toBe(false)
    })

    it('отсекает по функции и отдаёт в неё файл', () => {
        const options = resolveOptions({
            exclude: [(_name, file) => file?.includes('node_modules') ?? false],
        })
        expect(shouldTrack('Button', options, '/app/node_modules/x/Button.vue')).toBe(false)
        expect(shouldTrack('Button', options, '/app/src/Button.vue')).toBe(true)
    })

    it('include оставляет только перечисленное', () => {
        const options = resolveOptions({ include: ['Card', /^Product/] })
        expect(shouldTrack('Card', options)).toBe(true)
        expect(shouldTrack('ProductList', options)).toBe(true)
        expect(shouldTrack('Button', options)).toBe(false)
    })

    it('exclude сильнее include', () => {
        const options = resolveOptions({ include: ['Card'], exclude: ['Card'] })
        expect(shouldTrack('Card', options)).toBe(false)
    })
})

describe('enabled по умолчанию', () => {
    it('включён, когда опция не передана', () => {
        // Пакет намеренно не угадывает режим сборки: см. комментарий в options.ts.
        expect(resolveOptions().enabled).toBe(true)
    })

    it('явное значение всегда сильнее', () => {
        expect(resolveOptions({ enabled: false }).enabled).toBe(false)
        expect(resolveOptions({ enabled: true }).enabled).toBe(true)
    })
})
