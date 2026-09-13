import type { ComponentInternalInstance, VNode } from 'vue'

export interface Bounds {
    top: number
    left: number
    width: number
    height: number
}

/** Человекочитаемое имя компонента. */
export function getComponentName(instance: ComponentInternalInstance | null): string {
    if (!instance) return 'Anonymous'

    const type = instance.type as {
        displayName?: string
        name?: string
        __name?: string
        __file?: string
    }
    const name = type.displayName || type.name || type.__name
    if (name) return name

    const file = type.__file
    if (file) {
        const base = file.split(/[\\/]/).pop() || ''
        const withoutExt = base.replace(/\.\w+$/, '')
        if (withoutExt) return withoutExt
    }
    // Корневой компонент обычно безымянный — в отчёте «App» понятнее, чем «Anonymous».
    return instance.parent ? 'Anonymous' : 'App'
}

/** Путь к SFC. Проставляется @vitejs/plugin-vue только в деве. */
export function getComponentFile(instance: ComponentInternalInstance | null): string | undefined {
    if (!instance) return undefined
    return (instance.type as { __file?: string }).__file
}

export function getComponentUid(instance: ComponentInternalInstance): number {
    return instance.uid
}

/** Ближайший предок, за которым мы следим. Нужен для дерева. */
export function getTrackedParentUid(
    instance: ComponentInternalInstance,
    isTracked: (uid: number) => boolean,
): number | null {
    let parent = instance.parent
    while (parent) {
        if (isTracked(parent.uid)) return parent.uid
        parent = parent.parent
    }
    return null
}

const EMPTY_BOUNDS: Bounds = { top: 0, left: 0, width: 0, height: 0 }

/**
 * Габариты компонента на экране.
 * У фрагментов subTree.el — это якорный текстовый узел без размеров,
 * поэтому в таком случае собираем объединение прямоугольников детей.
 */
export function getComponentBounds(instance: ComponentInternalInstance): Bounds {
    const el = (instance.vnode?.el ?? instance.subTree?.el) as Node | null

    if (isElement(el)) return fromRect(el.getBoundingClientRect())

    const rects: DOMRect[] = []
    if (instance.subTree) collectRects(instance.subTree, rects, 0)
    if (rects.length === 0) return EMPTY_BOUNDS

    let top = Infinity
    let left = Infinity
    let right = -Infinity
    let bottom = -Infinity
    for (const rect of rects) {
        if (rect.width === 0 && rect.height === 0) continue
        top = Math.min(top, rect.top)
        left = Math.min(left, rect.left)
        right = Math.max(right, rect.right)
        bottom = Math.max(bottom, rect.bottom)
    }
    if (top === Infinity) return EMPTY_BOUNDS
    return { top, left, width: right - left, height: bottom - top }
}

const MAX_DEPTH = 8

function collectRects(vnode: VNode, out: DOMRect[], depth: number): void {
    if (depth > MAX_DEPTH || out.length > 64) return

    const el = vnode.el as Node | null
    if (isElement(el)) {
        out.push(el.getBoundingClientRect())
        return
    }
    if (Array.isArray(vnode.children)) {
        for (const child of vnode.children) {
            if (child && typeof child === 'object' && 'el' in child) {
                collectRects(child as VNode, out, depth + 1)
            }
        }
    }
    const componentSubTree = vnode.component?.subTree
    if (componentSubTree) collectRects(componentSubTree, out, depth + 1)
}

function isElement(node: unknown): node is Element {
    return !!node && typeof node === 'object' && (node as Node).nodeType === 1
        && typeof (node as Element).getBoundingClientRect === 'function'
}

function fromRect(rect: DOMRect): Bounds {
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
}

export function isInViewport(bounds: Bounds): boolean {
    if (bounds.width === 0 && bounds.height === 0) return false
    if (typeof window === 'undefined') return false
    return bounds.top < window.innerHeight
        && bounds.top + bounds.height > 0
        && bounds.left < window.innerWidth
        && bounds.left + bounds.width > 0
}
