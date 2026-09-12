import type { ComponentRecord, RenderEvent } from '../types'

export interface TreeNode extends ComponentRecord {
    children: TreeNode[]
    /** Сумма рендеров всего поддерева — видно, кто тянет за собой детей. */
    subtreeRenders: number
    depth: number
}

export interface RegistrySnapshot {
    records: ComponentRecord[]
    events: RenderEvent[]
    totalRenders: number
    totalComponents: number
    startedAt: number
}

export interface RegistryInit {
    maxEvents?: number
    now?: () => number
}

/**
 * Хранилище статистики. Специально не реактивное:
 * рендеры прилетают сотнями в секунду, и дёргать реактивность на каждый —
 * значит профилировать собственный оверхед. Панель забирает снимки по подписке.
 */
export class Registry {
    private records = new Map<number, ComponentRecord>()
    private events: RenderEvent[] = []
    private listeners = new Set<() => void>()
    private maxEvents: number
    private now: () => number
    private paused = false

    totalRenders = 0
    startedAt: number

    constructor(init: RegistryInit = {}) {
        this.maxEvents = Math.max(1, init.maxEvents ?? 500)
        this.now = init.now ?? (() => Date.now())
        this.startedAt = this.now()
    }

    setPaused(paused: boolean): void {
        this.paused = paused
        this.notify()
    }

    isPaused(): boolean {
        return this.paused
    }

    has(uid: number): boolean {
        return this.records.has(uid)
    }

    get(uid: number): ComponentRecord | undefined {
        return this.records.get(uid)
    }

    register(record: Pick<ComponentRecord, 'uid' | 'name' | 'file' | 'parentUid'>): ComponentRecord {
        const existing = this.records.get(record.uid)
        if (existing) return existing

        const created: ComponentRecord = {
            ...record,
            mountedAt: this.now(),
            renderCount: 0,
            flashCount: 0,
            totalDuration: 0,
            maxDuration: 0,
            lastDuration: 0,
            lastRenderAt: 0,
            lastReasons: [],
            lastPropChanges: [],
        }
        this.records.set(record.uid, created)
        this.notify()
        return created
    }

    unregister(uid: number): void {
        if (this.records.delete(uid)) this.notify()
    }

    record(event: RenderEvent): void {
        if (this.paused) return

        const record = this.records.get(event.uid)
        if (record) {
            record.renderCount++
            record.flashCount++
            record.totalDuration += event.duration
            record.maxDuration = Math.max(record.maxDuration, event.duration)
            record.lastDuration = event.duration
            record.lastRenderAt = event.timestamp
            record.lastReasons = event.reasons
            record.lastPropChanges = event.propChanges
        }

        this.totalRenders++
        this.events.push(event)
        // Кольцевой буфер: на долгой сессии иначе съедаем память.
        if (this.events.length > this.maxEvents) {
            this.events.splice(0, this.events.length - this.maxEvents)
        }
        this.notify()
    }

    resetFlashCount(uid: number): void {
        const record = this.records.get(uid)
        if (record) record.flashCount = 0
    }

    /** Топ по числу перерисовок. */
    top(limit = 20): ComponentRecord[] {
        return [...this.records.values()]
            .filter(record => record.renderCount > 0)
            .sort((a, b) => b.renderCount - a.renderCount || b.totalDuration - a.totalDuration)
            .slice(0, limit)
    }

    /** Топ по суммарному времени обновления. */
    slowest(limit = 20): ComponentRecord[] {
        return [...this.records.values()]
            .filter(record => record.renderCount > 0)
            .sort((a, b) => b.totalDuration - a.totalDuration || b.renderCount - a.renderCount)
            .slice(0, limit)
    }

    /** Дерево живых компонентов с суммой рендеров по поддереву. */
    tree(): TreeNode[] {
        const nodes = new Map<number, TreeNode>()
        for (const record of this.records.values()) {
            nodes.set(record.uid, { ...record, children: [], subtreeRenders: record.renderCount, depth: 0 })
        }

        const roots: TreeNode[] = []
        for (const node of nodes.values()) {
            const parent = node.parentUid !== null ? nodes.get(node.parentUid) : undefined
            if (parent) parent.children.push(node)
            else roots.push(node)
        }

        const applyDepth = (node: TreeNode, depth: number): number => {
            node.depth = depth
            let total = node.renderCount
            for (const child of node.children) total += applyDepth(child, depth + 1)
            node.subtreeRenders = total
            return total
        }
        for (const root of roots) applyDepth(root, 0)
        return roots
    }

    snapshot(): RegistrySnapshot {
        return {
            records: [...this.records.values()],
            events: [...this.events],
            totalRenders: this.totalRenders,
            totalComponents: this.records.size,
            startedAt: this.startedAt,
        }
    }

    getEvents(): RenderEvent[] {
        return [...this.events]
    }

    /** Сбрасывает счётчики, но оставляет дерево живых компонентов. */
    reset(): void {
        for (const record of this.records.values()) {
            record.renderCount = 0
            record.flashCount = 0
            record.totalDuration = 0
            record.maxDuration = 0
            record.lastDuration = 0
            record.lastRenderAt = 0
            record.lastReasons = []
            record.lastPropChanges = []
        }
        this.events = []
        this.totalRenders = 0
        this.startedAt = this.now()
        this.notify()
    }

    clear(): void {
        this.records.clear()
        this.events = []
        this.totalRenders = 0
        this.listeners.clear()
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    private notify(): void {
        for (const listener of this.listeners) listener()
    }
}
