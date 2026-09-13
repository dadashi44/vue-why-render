import { describe, expect, it } from 'vitest'
import type { ComponentInternalInstance, DebuggerEvent } from 'vue'
import { reactive, ref, shallowReactive, toRaw } from 'vue'
import { describeTrigger, dedupeReasons, diffProps, formatValue, snapshotProps } from '../src/core/reason'

function makeEvent(partial: Partial<DebuggerEvent> & { target: object }): DebuggerEvent {
    return {
        effect: {} as DebuggerEvent['effect'],
        type: 'set',
        key: 'x',
        ...partial,
    } as DebuggerEvent
}

describe('formatValue', () => {
    it('показывает примитивы как есть', () => {
        expect(formatValue(1)).toBe('1')
        expect(formatValue(true)).toBe('true')
        expect(formatValue(null)).toBe('null')
        expect(formatValue(undefined)).toBe('undefined')
        expect(formatValue('abc')).toBe('"abc"')
    })

    it('сворачивает коллекции в размер', () => {
        expect(formatValue([1, 2, 3])).toBe('Array(3)')
        expect(formatValue(new Map([['a', 1]]))).toBe('Map(1)')
        expect(formatValue(new Set([1, 2]))).toBe('Set(2)')
    })

    it('показывает ключи объекта', () => {
        expect(formatValue({ a: 1, b: 2 })).toBe('{ a, b }')
        expect(formatValue({ a: 1, b: 2, c: 3, d: 4 })).toBe('{ a, b, c, … }')
        expect(formatValue({})).toBe('{}')
    })

    it('не падает на циклических структурах', () => {
        const cyclic: Record<string, unknown> = { name: 'root' }
        cyclic.self = cyclic
        expect(formatValue(cyclic)).toBe('{ name, self }')
    })

    it('разворачивает реактивный прокси до сырого объекта', () => {
        expect(formatValue(reactive({ a: 1 }))).toBe('{ a }')
    })

    it('обрезает длинные строки', () => {
        const long = formatValue('x'.repeat(200))
        expect(long.length).toBeLessThanOrEqual(48)
        expect(long.endsWith('…')).toBe(true)
    })

    it('называет функции', () => {
        expect(formatValue(function handler() {})).toBe('ƒ handler()')
    })
})

describe('describeTrigger', () => {
    it('узнаёт проп по ссылке на props инстанса', () => {
        const props = shallowReactive({ title: 'a' })
        const instance = { props, setupState: {}, data: null } as unknown as ComponentInternalInstance

        const reason = describeTrigger(
            makeEvent({ target: toRaw(props), key: 'title', oldValue: 'a', newValue: 'b' }),
            instance,
        )
        expect(reason).toMatchObject({ source: 'props', key: 'title', oldValue: '"a"', newValue: '"b"' })
    })

    it('находит имя рефа в setupState вместо бесполезного value', () => {
        const counter = ref(0)
        const instance = {
            props: {},
            setupState: { counter },
            data: null,
        } as unknown as ComponentInternalInstance

        const reason = describeTrigger(
            makeEvent({ target: toRaw(counter), key: 'value', oldValue: 0, newValue: 1 }),
            instance,
        )
        expect(reason.source).toBe('setup')
        expect(reason.key).toBe('counter')
    })

    it('честно говорит ref, если имя не нашлось', () => {
        const orphan = ref(0)
        const instance = { props: {}, setupState: {}, data: null } as unknown as ComponentInternalInstance
        const reason = describeTrigger(makeEvent({ target: toRaw(orphan), key: 'value' }), instance)
        expect(reason).toMatchObject({ source: 'setup', key: 'ref' })
    })

    it('помечает стор по $id', () => {
        const store = { $id: 'cart', items: [] }
        const reason = describeTrigger(makeEvent({ target: store, key: 'items' }))
        expect(reason).toMatchObject({ source: 'store', key: 'cart.items' })
    })

    it('помечает массив и оборачивает индекс в скобки', () => {
        const reason = describeTrigger(makeEvent({ target: [1, 2], key: '0' }))
        expect(reason).toMatchObject({ source: 'array', key: '[0]' })
    })

    it('помечает Map и Set как коллекции', () => {
        expect(describeTrigger(makeEvent({ target: new Map(), key: 'a' })).source).toBe('collection')
        expect(describeTrigger(makeEvent({ target: new Set(), key: 'a' })).source).toBe('collection')
    })

    it('узнаёт data из Options API', () => {
        const data = reactive({ count: 0 })
        const instance = { props: {}, setupState: {}, data } as unknown as ComponentInternalInstance
        const reason = describeTrigger(makeEvent({ target: toRaw(data), key: 'count' }), instance)
        expect(reason.source).toBe('data')
    })

    it('приводит символьный ключ к читаемому виду', () => {
        const reason = describeTrigger(makeEvent({ target: {}, key: Symbol('iterate') }))
        expect(reason.key).toBe('iterate')
    })

    it('переносит тип операции', () => {
        const reason = describeTrigger(makeEvent({ target: {}, type: 'add' as DebuggerEvent['type'], key: 'a' }))
        expect(reason.type).toBe('add')
    })

    it('не падает без инстанса', () => {
        expect(() => describeTrigger(makeEvent({ target: {} }))).not.toThrow()
    })
})

describe('dedupeReasons', () => {
    it('схлопывает повторы по source+key+type', () => {
        const reasons = dedupeReasons([
            { type: 'set', key: 'a', source: 'props' },
            { type: 'set', key: 'a', source: 'props' },
            { type: 'set', key: 'b', source: 'props' },
        ])
        expect(reasons).toHaveLength(2)
    })

    it('уважает лимит', () => {
        const many = Array.from({ length: 50 }, (_, index) => ({
            type: 'set',
            key: `k${index}`,
            source: 'setup' as const,
        }))
        expect(dedupeReasons(many, 5)).toHaveLength(5)
    })
})

describe('diffProps', () => {
    it('находит изменённые, добавленные и удалённые пропы', () => {
        const changes = diffProps({ a: 1, removed: true }, { a: 2, added: 'x' })
        const keys = changes.map(change => change.key).sort()
        expect(keys).toEqual(['a', 'added', 'removed'])
    })

    it('молчит, когда ничего не изменилось', () => {
        expect(diffProps({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toEqual([])
    })

    it('помечает новую ссылку на эквивалентный объект', () => {
        const changes = diffProps({ user: { id: 1 } }, { user: { id: 1 } })
        expect(changes).toHaveLength(1)
        expect(changes[0].referenceOnly).toBe(true)
    })

    it('не помечает referenceOnly, если содержимое реально разное', () => {
        const changes = diffProps({ user: { id: 1 } }, { user: { id: 2 } })
        expect(changes[0].referenceOnly).toBe(false)
    })

    it('считает разные по длине массивы разными', () => {
        const changes = diffProps({ list: [1] }, { list: [1, 2] })
        expect(changes[0].referenceOnly).toBe(false)
    })

    it('возвращает пустой список, если снимка нет', () => {
        expect(diffProps(null, { a: 1 })).toEqual([])
        expect(diffProps({ a: 1 }, null)).toEqual([])
    })

    it('не считает NaN изменением', () => {
        expect(diffProps({ a: Number.NaN }, { a: Number.NaN })).toEqual([])
    })
})

describe('snapshotProps', () => {
    it('делает копию, которая не меняется вслед за оригиналом', () => {
        const props = shallowReactive<Record<string, unknown>>({ a: 1 })
        const snapshot = snapshotProps(props)
        props.a = 2
        expect(snapshot.a).toBe(1)
    })

    it('переживает отсутствие пропсов', () => {
        expect(snapshotProps(null)).toEqual({})
        expect(snapshotProps(undefined)).toEqual({})
    })
})
