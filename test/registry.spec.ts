import { describe, expect, it, vi } from 'vitest'
import { Registry } from '../src/core/registry'
import type { RenderEvent } from '../src/types'

function event(uid: number, partial: Partial<RenderEvent> = {}): RenderEvent {
    return {
        uid,
        name: `C${uid}`,
        phase: 'update',
        duration: 1,
        fps: 60,
        timestamp: 1000,
        reasons: [],
        propChanges: [],
        ...partial,
    }
}

function registryWith(uids: number[], parents: Record<number, number | null> = {}): Registry {
    const registry = new Registry()
    for (const uid of uids) {
        registry.register({ uid, name: `C${uid}`, file: undefined, parentUid: parents[uid] ?? null })
    }
    return registry
}

describe('Registry', () => {
    it('регистрирует компонент один раз', () => {
        const registry = registryWith([1])
        registry.register({ uid: 1, name: 'Other', file: undefined, parentUid: null })
        expect(registry.snapshot().totalComponents).toBe(1)
        expect(registry.get(1)?.name).toBe('C1')
    })

    it('копит счётчики и тайминги', () => {
        const registry = registryWith([1])
        registry.record(event(1, { duration: 2 }))
        registry.record(event(1, { duration: 6 }))

        const record = registry.get(1)!
        expect(record.renderCount).toBe(2)
        expect(record.totalDuration).toBe(8)
        expect(record.maxDuration).toBe(6)
        expect(record.lastDuration).toBe(6)
    })

    it('не теряет событие от незарегистрированного компонента', () => {
        const registry = new Registry()
        registry.record(event(42))
        expect(registry.getEvents()).toHaveLength(1)
        expect(registry.totalRenders).toBe(1)
    })

    it('держит кольцевой буфер событий', () => {
        const registry = new Registry({ maxEvents: 3 })
        for (let i = 0; i < 10; i++) registry.record(event(1, { timestamp: i }))

        const events = registry.getEvents()
        expect(events).toHaveLength(3)
        expect(events.map(item => item.timestamp)).toEqual([7, 8, 9])
        expect(registry.totalRenders).toBe(10)
    })

    it('на паузе не пишет ничего', () => {
        const registry = registryWith([1])
        registry.setPaused(true)
        registry.record(event(1))
        expect(registry.totalRenders).toBe(0)
        expect(registry.get(1)?.renderCount).toBe(0)
    })

    it('сортирует топ по числу рендеров', () => {
        const registry = registryWith([1, 2, 3])
        registry.record(event(1))
        registry.record(event(2))
        registry.record(event(2))
        expect(registry.top().map(record => record.uid)).toEqual([2, 1])
    })

    it('сортирует медленные по суммарному времени', () => {
        const registry = registryWith([1, 2])
        registry.record(event(1, { duration: 50 }))
        registry.record(event(2, { duration: 5 }))
        registry.record(event(2, { duration: 5 }))
        expect(registry.slowest().map(record => record.uid)).toEqual([1, 2])
    })

    it('уважает лимит в топе', () => {
        const registry = registryWith([1, 2, 3])
        for (const uid of [1, 2, 3]) registry.record(event(uid))
        expect(registry.top(2)).toHaveLength(2)
    })

    it('строит дерево и суммирует рендеры поддерева', () => {
        const registry = registryWith([1, 2, 3], { 2: 1, 3: 2 })
        registry.record(event(1))
        registry.record(event(2))
        registry.record(event(3))
        registry.record(event(3))

        const [root] = registry.tree()
        expect(root.uid).toBe(1)
        expect(root.subtreeRenders).toBe(4)
        expect(root.children[0].uid).toBe(2)
        expect(root.children[0].subtreeRenders).toBe(3)
        expect(root.children[0].children[0].depth).toBe(2)
    })

    it('поднимает узел в корень, если родителя уже размонтировали', () => {
        const registry = registryWith([1, 2], { 2: 1 })
        registry.unregister(1)
        expect(registry.tree().map(node => node.uid)).toEqual([2])
    })

    it('сбрасывает счётчики, но оставляет компоненты', () => {
        const registry = registryWith([1])
        registry.record(event(1, { duration: 3 }))
        registry.reset()

        expect(registry.totalRenders).toBe(0)
        expect(registry.getEvents()).toHaveLength(0)
        expect(registry.snapshot().totalComponents).toBe(1)
        expect(registry.get(1)?.renderCount).toBe(0)
    })

    it('уведомляет подписчиков и умеет отписываться', () => {
        const registry = registryWith([1])
        const listener = vi.fn()
        const unsubscribe = registry.subscribe(listener)

        registry.record(event(1))
        expect(listener).toHaveBeenCalledTimes(1)

        unsubscribe()
        registry.record(event(1))
        expect(listener).toHaveBeenCalledTimes(1)
    })

    it('снимок не связан с внутренним состоянием', () => {
        const registry = registryWith([1])
        const snapshot = registry.snapshot()
        registry.record(event(1))
        expect(snapshot.events).toHaveLength(0)
    })

    it('обнуляет счётчик вспышек', () => {
        const registry = registryWith([1])
        registry.record(event(1))
        expect(registry.get(1)?.flashCount).toBe(1)
        registry.resetFlashCount(1)
        expect(registry.get(1)?.flashCount).toBe(0)
    })
})
