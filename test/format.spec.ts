import { describe, expect, it } from 'vitest'
import {
    averageDuration,
    buildEditorUrl,
    formatDuration,
    formatPropChange,
    formatReason,
    matchesQuery,
    shortFile,
} from '../src/panel/format'
import type { ComponentRecord } from '../src/types'

const record = (partial: Partial<ComponentRecord> = {}): ComponentRecord => ({
    uid: 1,
    name: 'Card',
    file: '/app/src/components/Card.vue',
    parentUid: null,
    mountedAt: 0,
    renderCount: 4,
    flashCount: 0,
    totalDuration: 10,
    maxDuration: 5,
    lastDuration: 2,
    lastRenderAt: 0,
    lastReasons: [],
    lastPropChanges: [],
    ...partial,
})

describe('formatReason', () => {
    it('показывает переход значения', () => {
        expect(formatReason({ type: 'set', key: 'count', source: 'setup', oldValue: '0', newValue: '1' }))
            .toBe('состояние count: 0 → 1')
    })

    it('называет источник по-человечески', () => {
        expect(formatReason({ type: 'set', key: 'title', source: 'props' })).toBe('проп title')
        expect(formatReason({ type: 'set', key: 'cart.items', source: 'store' })).toBe('стор cart.items')
    })

    it('дописывает тип операции, если это не обычный set', () => {
        expect(formatReason({ type: 'add', key: '[2]', source: 'array' })).toBe('массив [2] (add)')
    })
})

describe('formatPropChange', () => {
    it('показывает переход', () => {
        expect(formatPropChange({ key: 'title', oldValue: '"a"', newValue: '"b"', referenceOnly: false }))
            .toBe('проп title: "a" → "b"')
    })

    it('предупреждает про новую ссылку на то же значение', () => {
        const text = formatPropChange({ key: 'user', oldValue: '{ id }', newValue: '{ id }', referenceOnly: true })
        expect(text).toContain('новая ссылка')
    })
})

describe('formatDuration', () => {
    it('прячет нули за прочерком', () => {
        expect(formatDuration(0)).toBe('—')
        expect(formatDuration(-1)).toBe('—')
    })

    it('добавляет точности мелким значениям', () => {
        expect(formatDuration(0.25)).toBe('0.25ms')
        expect(formatDuration(12.34)).toBe('12.3ms')
        expect(formatDuration(1234.5)).toBe('1235ms')
    })
})

describe('averageDuration', () => {
    it('делит общее время на число рендеров', () => {
        expect(averageDuration(record({ totalDuration: 10, renderCount: 4 }))).toBe(2.5)
    })

    it('не делит на ноль', () => {
        expect(averageDuration(record({ renderCount: 0 }))).toBe(0)
    })
})

describe('shortFile', () => {
    it('оставляет две последние части пути', () => {
        expect(shortFile('/app/src/components/Card.vue')).toBe('components/Card.vue')
    })

    it('переживает отсутствие файла', () => {
        expect(shortFile(undefined)).toBe('')
    })
})

describe('matchesQuery', () => {
    it('пустой запрос пропускает всё', () => {
        expect(matchesQuery(record(), '  ')).toBe(true)
    })

    it('ищет по имени без учёта регистра', () => {
        expect(matchesQuery(record(), 'car')).toBe(true)
        expect(matchesQuery(record(), 'CARD')).toBe(true)
    })

    it('ищет по пути к файлу', () => {
        expect(matchesQuery(record(), 'components/')).toBe(true)
    })

    it('отсекает непохожее', () => {
        expect(matchesQuery(record(), 'button')).toBe(false)
    })
})

describe('buildEditorUrl', () => {
    it('подставляет файл в шаблон и экранирует путь', () => {
        expect(buildEditorUrl('/__open-in-editor?file={file}', '/app/src/A B.vue'))
            .toBe('/__open-in-editor?file=%2Fapp%2Fsrc%2FA%20B.vue')
    })
})
