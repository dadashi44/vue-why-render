import { describe, expect, it } from 'vitest'
import { hintsFor, hintsForRecord } from '../src/core/hints'
import { formatHint, formatPropChange } from '../src/panel/format'
import { getMessages } from '../src/i18n'
import { resolveOptions } from '../src/options'
import type { ComponentRecord, PropChange, RenderReason } from '../src/types'

const watching = { trackProps: true, trackReasons: true }

function prop(partial: Partial<PropChange> & Pick<PropChange, 'key'>): PropChange {
    return { oldValue: 'a', newValue: 'b', referenceOnly: false, newFunction: false, ...partial }
}

function reason(key: string): RenderReason {
    return { type: 'set', key, source: 'setup' }
}

describe('hintsFor', () => {
    it('узнаёт пересобранный объект по referenceOnly', () => {
        const hints = hintsFor({
            renderCount: 9,
            updateCount: 9,
            reasons: [],
            propChanges: [prop({ key: 'badge', referenceOnly: true })],
        }, watching)
        expect(hints).toEqual([{ code: 'newReference', keys: ['badge'] }])
    })

    it('узнаёт обработчик, который создаётся заново', () => {
        const hints = hintsFor({
            renderCount: 9,
            updateCount: 9,
            reasons: [],
            propChanges: [prop({ key: 'onPick', newFunction: true })],
        }, watching)
        expect(hints).toEqual([{ code: 'newFunction', keys: ['onPick'] }])
    })

    it('собирает все проблемные пропы в одну подсказку, а не плодит их', () => {
        const hints = hintsFor({
            renderCount: 3,
            updateCount: 3,
            reasons: [],
            propChanges: [
                prop({ key: 'badge', referenceOnly: true }),
                prop({ key: 'meta', referenceOnly: true }),
            ],
        }, watching)
        expect(hints).toHaveLength(1)
        expect(hints[0].keys).toEqual(['badge', 'meta'])
    })

    it('считает рендер родительским, когда своих изменений не было', () => {
        const hints = hintsFor({ renderCount: 4, updateCount: 4, reasons: [], propChanges: [] }, watching)
        expect(hints).toEqual([{ code: 'parentRender', keys: [] }])
    })

    it('не зовёт v-memo, когда у компонента есть своя причина', () => {
        const hints = hintsFor({ renderCount: 4, updateCount: 4, reasons: [reason('count')], propChanges: [] }, watching)
        expect(hints).toEqual([])
    })

    it('молчит про родителя при trackProps: false — это «мы не смотрели», а не «не менялось»', () => {
        const hints = hintsFor(
            { renderCount: 4, updateCount: 4, reasons: [], propChanges: [] },
            { trackProps: false, trackReasons: true },
        )
        expect(hints).toEqual([])
    })

    it('молчит про родителя при trackReasons: false по той же причине', () => {
        const hints = hintsFor(
            { renderCount: 4, updateCount: 4, reasons: [], propChanges: [] },
            { trackProps: true, trackReasons: false },
        )
        expect(hints).toEqual([])
    })

    it('не разбирает пропы при trackProps: false', () => {
        const hints = hintsFor(
            { renderCount: 4, updateCount: 4, reasons: [reason('count')], propChanges: [prop({ key: 'badge', referenceOnly: true })] },
            { trackProps: false, trackReasons: true },
        )
        expect(hints).toEqual([])
    })

    it('не зовёт в v-memo компонент, который только смонтировался', () => {
        // Живой случай из Nuxt: при includeMounts у таких ×1, и совет
        // мемоизировать то, что ни разу не обновлялось, — вредный.
        const hints = hintsFor({ renderCount: 1, updateCount: 0, reasons: [], propChanges: [] }, watching)
        expect(hints).toEqual([])
    })

    it('зовёт в v-memo, когда обновление действительно было', () => {
        const hints = hintsFor({ renderCount: 3, updateCount: 2, reasons: [], propChanges: [] }, watching)
        expect(hints).toEqual([{ code: 'parentRender', keys: [] }])
    })

    it('ничего не советует компоненту, который ни разу не перерисовался', () => {
        const hints = hintsFor({
            renderCount: 0,
            updateCount: 0,
            reasons: [],
            propChanges: [],
        }, watching)
        expect(hints).toEqual([])
    })

    it('две разные проблемы дают две подсказки', () => {
        const hints = hintsFor({
            renderCount: 5,
            updateCount: 5,
            reasons: [],
            propChanges: [
                prop({ key: 'badge', referenceOnly: true }),
                prop({ key: 'onPick', newFunction: true }),
            ],
        }, watching)
        expect(hints.map(hint => hint.code)).toEqual(['newReference', 'newFunction'])
    })
})

describe('hintsForRecord', () => {
    it('читает живую запись реестра', () => {
        const record: ComponentRecord = {
            uid: 1,
            name: 'Card',
            parentUid: null,
            mountedAt: 0,
            renderCount: 3,
            updateCount: 3,
            flashCount: 0,
            totalDuration: 3,
            maxDuration: 1,
            lastDuration: 1,
            lastRenderAt: 0,
            lastReasons: [],
            lastPropChanges: [prop({ key: 'badge', referenceOnly: true })],
        }
        expect(hintsForRecord(record, resolveOptions())).toEqual([{ code: 'newReference', keys: ['badge'] }])
    })
})

describe('вывод', () => {
    const en = getMessages('en')
    const ru = getMessages('ru')

    it('помечает пропс-функцию, иначе в панели две одинаковых строки без объяснения', () => {
        const change = prop({ key: 'onPick', oldValue: 'ƒ onPick()', newValue: 'ƒ onPick()', newFunction: true })
        expect(formatPropChange(change, en)).toBe('prop onPick: ƒ onPick() → ƒ onPick() — a new function every render')
    })

    it('«новая ссылка» важнее «новой функции», если вдруг совпали', () => {
        const change = prop({ key: 'x', referenceOnly: true, newFunction: true })
        expect(formatPropChange(change, en)).toContain('new reference, same value')
    })

    it('называет пропы в подсказке', () => {
        const line = formatHint({ code: 'newReference', keys: ['badge'] }, ru)
        expect(line).toBe('badge: похоже, объект собирается заново в родителе — вынеси в константу или computed')
    })

    it('подсказка без пропов идёт одним текстом', () => {
        expect(formatHint({ code: 'parentRender', keys: [] }, ru)).toBe(
            'перерисовал родитель, свои данные не менялись — кандидат на v-memo',
        )
    })

    it('формулировки остаются версиями, а не приказами', () => {
        // Проверяем словарь целиком: подсказка-диагноз хуже отсутствия подсказки.
        expect(ru.hints.newReference).toContain('похоже')
        expect(en.hints.newReference).toContain('looks like')
        expect(en.hints.parentRender).toContain('candidate')
    })

    it('словари заполнены во всех локалях', () => {
        for (const locale of ['en', 'ru', 'zh-CN'] as const) {
            const t = getMessages(locale)
            for (const code of ['newReference', 'newFunction', 'parentRender'] as const) {
                expect(t.hints[code], `${locale}/${code}`).toBeTruthy()
            }
            expect(t.newFunction, `${locale}/newFunction`).toBeTruthy()
        }
    })
})
