import type { ReasonSource } from '../types'

export interface DepNode {
    id: string
    label: string
    source: ReasonSource
    store?: string
}

export interface DepEdge {
    componentUid: number
    dep: DepNode
    /** Сколько раз зависимость читалась при рендере. */
    reads: number
    /** Сколько раз зависимость вызывала перерисовку. */
    triggers: number
}

export interface DepsSnapshot {
    nodes: DepNode[]
    edges: DepEdge[]
    components: { uid: number, name: string, file?: string }[]
}

/**
 * Граф реактивных зависимостей компонентов.
 *
 * renderTracked стреляет на каждое чтение реактивного источника —
 * тысячи раз в секунду. Хранилище агрегирует их в рёбра «компонент ← источник»
 * со счётчиками, а не копит отдельные события.
 */
export class DepsGraph {
    private edges = new Map<string, DepEdge>()
    private nodes = new Map<string, DepNode>()
    private components = new Map<number, { name: string, file?: string }>()
    private listeners = new Set<() => void>()
    private dirty = false
    private flushTimer: ReturnType<typeof setTimeout> | null = null

    registerComponent(uid: number, name: string, file?: string): void {
        if (!this.components.has(uid)) {
            this.components.set(uid, { name, file })
        }
    }

    unregisterComponent(uid: number): void {
        this.components.delete(uid)
        for (const [key, edge] of this.edges) {
            if (edge.componentUid === uid) this.edges.delete(key)
        }
        this.markDirty()
    }

    recordRead(uid: number, depId: string, label: string, source: ReasonSource, store?: string): void {
        if (!this.nodes.has(depId)) {
            this.nodes.set(depId, { id: depId, label, source, store })
        }

        const edgeKey = `${uid}:${depId}`
        const existing = this.edges.get(edgeKey)
        if (existing) {
            existing.reads++
        } else {
            this.edges.set(edgeKey, {
                componentUid: uid,
                dep: this.nodes.get(depId)!,
                reads: 1,
                triggers: 0,
            })
        }
        this.markDirty()
    }

    recordTrigger(uid: number, depId: string, label: string, source: ReasonSource, store?: string): void {
        if (!this.nodes.has(depId)) {
            this.nodes.set(depId, { id: depId, label, source, store })
        }

        const edgeKey = `${uid}:${depId}`
        const existing = this.edges.get(edgeKey)
        if (existing) {
            existing.triggers++
        } else {
            this.edges.set(edgeKey, {
                componentUid: uid,
                dep: this.nodes.get(depId)!,
                reads: 0,
                triggers: 1,
            })
        }
        this.markDirty()
    }

    snapshot(): DepsSnapshot {
        const usedDepIds = new Set<string>()
        const edges = [...this.edges.values()]
        for (const e of edges) usedDepIds.add(e.dep.id)

        return {
            nodes: [...this.nodes.values()].filter(n => usedDepIds.has(n.id)),
            edges,
            components: [...this.components.entries()].map(([uid, c]) => ({ uid, ...c })),
        }
    }

    /** Зависимости конкретного компонента. */
    depsOf(uid: number): DepEdge[] {
        return [...this.edges.values()].filter(e => e.componentUid === uid)
    }

    /** Компоненты, зависящие от источника. */
    dependents(depId: string): { uid: number, name: string, reads: number, triggers: number }[] {
        const out: { uid: number, name: string, reads: number, triggers: number }[] = []
        for (const edge of this.edges.values()) {
            if (edge.dep.id === depId) {
                const comp = this.components.get(edge.componentUid)
                if (comp) {
                    out.push({ uid: edge.componentUid, name: comp.name, reads: edge.reads, triggers: edge.triggers })
                }
            }
        }
        return out.sort((a, b) => b.triggers - a.triggers || b.reads - a.reads)
    }

    reset(): void {
        this.edges.clear()
        this.nodes.clear()
        this.notify()
    }

    clear(): void {
        this.edges.clear()
        this.nodes.clear()
        this.components.clear()
        this.listeners.clear()
        if (this.flushTimer) clearTimeout(this.flushTimer)
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener)
        return () => { this.listeners.delete(listener) }
    }

    private markDirty(): void {
        if (this.dirty) return
        this.dirty = true
        if (this.flushTimer) return
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null
            this.dirty = false
            this.notify()
        }, 300)
    }

    private notify(): void {
        for (const listener of this.listeners) listener()
    }
}
