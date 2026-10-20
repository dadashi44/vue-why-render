import type { Bounds } from '../core/instance'
import { isInViewport } from '../core/instance'

interface HighlightItem {
    bounds: Bounds
    /** Замерить заново. Нет — рамка стоит там, где её нарисовали. */
    measure?: () => Bounds
    label: string
    heat: number
    startedAt: number
    updatedAt: number
    opacity: number
    state: 'fade-in' | 'visible' | 'fade-out'
}

export interface OverlayOptions {
    displayDuration?: number
    fadeInDuration?: number
    fadeOutDuration?: number
    showLabels?: boolean
}

const FADE_IN = 25
const FADE_OUT = 120
const LABEL_HEIGHT = 15
const LABEL_PADDING = 4
/**
 * Рамки уже́ этого получают подпись только под курсором. В плотной сетке
 * мелких карточек подписи иначе складываются в сплошную нечитаемую полосу.
 */
const MIN_LABELED_WIDTH = 48
const MIN_LABELED_HEIGHT = 16

interface LabelRect {
    left: number
    top: number
    width: number
    height: number
}

function overlaps(a: LabelRect, b: LabelRect): boolean {
    return a.left < b.left + b.width && b.left < a.left + a.width
        && a.top < b.top + b.height && b.top < a.top + a.height
}

function contains(bounds: Bounds, x: number, y: number): boolean {
    return x >= bounds.left && x <= bounds.left + bounds.width
        && y >= bounds.top && y <= bounds.top + bounds.height
}

/** Цвет рамки от зелёного к красному по «жару» 0..1. */
export function heatColor(heat: number, opacity: number): string {
    const clamped = Math.min(1, Math.max(0, heat))
    const red = Math.round(60 + clamped * 195)
    const green = Math.round(200 - clamped * 180)
    return `rgba(${red}, ${green}, 90, ${opacity})`
}

/**
 * Оверлей поверх страницы. Один canvas на всё приложение:
 * рисовать рамки DOM-элементами дороже и ломает layout хост-страницы.
 */
export class Overlay {
    private canvas: HTMLCanvasElement | null = null
    private ctx: CanvasRenderingContext2D | null = null
    private items = new Map<string, HighlightItem>()
    private frame: number | null = null
    private displayDuration: number
    private showLabels: boolean
    private fadeIn: number
    private fadeOut: number
    private disposed = false
    private pointer: { x: number, y: number } | null = null
    /** Страницу прокрутили — координаты рамок устарели, пересчёт в ближайшем кадре. */
    private stale = false
    private onResize = (): void => {
        this.resize()
        this.invalidate()
    }
    private onScroll = (): void => this.invalidate()
    private onPointerMove = (event: PointerEvent): void => {
        this.pointer = { x: event.clientX, y: event.clientY }
        // Перерисовываем только пока есть что подписывать: курсор над пустой
        // страницей не должен будить requestAnimationFrame.
        if (this.items.size > 0 && this.showLabels) this.schedule()
    }

    constructor(options: OverlayOptions = {}) {
        this.displayDuration = options.displayDuration ?? 600
        this.showLabels = options.showLabels ?? true
        this.fadeIn = options.fadeInDuration ?? FADE_IN
        this.fadeOut = options.fadeOutDuration ?? FADE_OUT
        this.mount()
    }

    private mount(): void {
        if (typeof document === 'undefined') return

        const canvas = document.createElement('canvas')
        canvas.dataset.vueWhyRender = 'overlay'
        Object.assign(canvas.style, {
            position: 'fixed',
            inset: '0',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: '2147483646',
        } satisfies Partial<CSSStyleDeclaration>)

        // В jsdom и в окружениях без 2d-контекста просто работаем вхолостую.
        const ctx = canvas.getContext?.('2d') ?? null
        if (!ctx) return

        document.body.appendChild(canvas)
        this.canvas = canvas
        this.ctx = ctx
        this.resize()
        window.addEventListener('resize', this.onResize, { passive: true })
        // capture: событие scroll не всплывает, и без него прокрутка внутри
        // блока с overflow: auto проходила бы мимо — рамки оставались бы на месте.
        window.addEventListener('scroll', this.onScroll, { passive: true, capture: true })
        if (this.showLabels) {
            window.addEventListener('pointermove', this.onPointerMove, { passive: true })
        }
    }

    private resize(): void {
        if (!this.canvas || !this.ctx) return
        const dpr = window.devicePixelRatio || 1
        this.canvas.width = Math.floor(window.innerWidth * dpr)
        this.canvas.height = Math.floor(window.innerHeight * dpr)
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    /**
     * Координаты рамок пересчитываются не на каждое событие скролла, а раз
     * в кадр: за один кадр скролл приходит десятками, а замер — это
     * getBoundingClientRect на каждый компонент.
     */
    private invalidate(): void {
        if (this.items.size === 0) return
        this.stale = true
        this.schedule()
    }

    private remeasure(): void {
        this.stale = false
        for (const item of this.items.values()) {
            if (!item.measure) continue
            try {
                item.bounds = item.measure()
            }
            catch {
                // Компонент мог уйти из DOM между рендером и кадром — рамка доживёт на прежнем месте.
            }
        }
    }

    highlight(id: string, bounds: Bounds, label: string, heat: number, measure?: () => Bounds): void {
        if (this.disposed || !this.ctx) return
        if (!isInViewport(bounds)) return

        const now = Date.now()
        const existing = this.items.get(id)
        if (existing) {
            existing.bounds = bounds
            existing.measure = measure
            existing.label = label
            existing.heat = heat
            existing.updatedAt = now
            if (existing.state === 'fade-out') {
                existing.state = 'visible'
                existing.startedAt = now
                existing.opacity = 1
            }
        }
        else {
            this.items.set(id, {
                bounds,
                measure,
                label,
                heat,
                startedAt: now,
                updatedAt: now,
                opacity: 0,
                state: 'fade-in',
            })
        }
        this.schedule()
    }

    clear(id: string): void {
        this.items.delete(id)
    }

    clearAll(): void {
        this.items.clear()
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        }
    }

    private schedule(): void {
        if (this.frame !== null || typeof requestAnimationFrame === 'undefined') return
        this.frame = requestAnimationFrame(() => this.render())
    }

    private render(): void {
        this.frame = null
        const ctx = this.ctx
        const canvas = this.canvas
        if (!ctx || !canvas) return

        if (this.stale) this.remeasure()

        const now = Date.now()
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace'
        ctx.textBaseline = 'middle'

        const visible: HighlightItem[] = []
        for (const [id, item] of this.items) {
            const sinceStart = now - item.startedAt
            const idle = now - item.updatedAt

            switch (item.state) {
                case 'fade-in':
                    item.opacity = this.fadeIn === 0 ? 1 : Math.min(1, sinceStart / this.fadeIn)
                    if (sinceStart >= this.fadeIn) {
                        item.state = 'visible'
                        item.opacity = 1
                    }
                    break
                case 'visible':
                    if (idle >= this.displayDuration) {
                        item.state = 'fade-out'
                        item.startedAt = now
                    }
                    break
                case 'fade-out': {
                    const progress = this.fadeOut === 0 ? 1 : sinceStart / this.fadeOut
                    item.opacity = Math.max(0, 1 - progress)
                    if (progress >= 1) {
                        this.items.delete(id)
                        continue
                    }
                    break
                }
            }

            if (!isInViewport(item.bounds)) continue
            this.drawBox(item)
            visible.push(item)
        }

        // Подписи — вторым проходом, поверх всех рамок: иначе рамка соседа
        // перечёркивает уже нарисованный текст.
        if (this.showLabels) this.drawLabels(visible)

        if (this.items.size > 0) this.schedule()
    }

    private drawBox(item: HighlightItem): void {
        const ctx = this.ctx
        if (!ctx) return
        const { bounds, opacity } = item

        ctx.strokeStyle = heatColor(item.heat, opacity)
        ctx.lineWidth = 1.5
        ctx.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height)
    }

    /**
     * Подписи без наложений. Место раздаётся по «жару»: самый горячий
     * компонент — самый интересный, его подпись видна всегда, а соседняя,
     * которая на неё налезла бы, пропускается. Подпись под курсором
     * рисуется в любом случае и последней — то, что навёл, видно всегда.
     */
    private drawLabels(items: HighlightItem[]): void {
        const ctx = this.ctx
        if (!ctx) return

        const pointer = this.pointer
        const hovered = pointer
            // Самая вложенная рамка под курсором — та, что меньше по площади.
            ? items
                .filter(item => contains(item.bounds, pointer.x, pointer.y))
                .sort((a, b) => a.bounds.width * a.bounds.height - b.bounds.width * b.bounds.height)[0]
            : undefined

        const placed: LabelRect[] = []
        const hoveredRect = hovered ? this.labelRect(hovered) : null
        if (hoveredRect) placed.push(hoveredRect)

        const candidates = items
            .filter(item => item !== hovered
                && item.bounds.width >= MIN_LABELED_WIDTH
                && item.bounds.height >= MIN_LABELED_HEIGHT)
            .sort((a, b) => b.heat - a.heat)

        for (const item of candidates) {
            const rect = this.labelRect(item)
            if (placed.some(other => overlaps(rect, other))) continue
            placed.push(rect)
            this.drawLabel(item, rect)
        }

        if (hovered && hoveredRect) this.drawLabel(hovered, hoveredRect)
    }

    private labelRect(item: HighlightItem): LabelRect {
        const width = (this.ctx?.measureText(item.label).width ?? 0) + LABEL_PADDING * 2
        const { bounds } = item
        // Если места сверху нет — кладём подпись внутрь рамки, иначе уедет за экран.
        const top = bounds.top > LABEL_HEIGHT ? bounds.top - LABEL_HEIGHT : bounds.top
        return { left: bounds.left, top, width, height: LABEL_HEIGHT }
    }

    private drawLabel(item: HighlightItem, rect: LabelRect): void {
        const ctx = this.ctx
        if (!ctx) return
        ctx.fillStyle = heatColor(item.heat, item.opacity * 0.9)
        ctx.fillRect(rect.left, rect.top, rect.width, rect.height)
        ctx.fillStyle = `rgba(255, 255, 255, ${item.opacity})`
        ctx.fillText(item.label, rect.left + LABEL_PADDING, rect.top + rect.height / 2)
    }

    dispose(): void {
        this.disposed = true
        if (this.frame !== null && typeof cancelAnimationFrame !== 'undefined') {
            cancelAnimationFrame(this.frame)
        }
        this.frame = null
        this.items.clear()
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this.onResize)
            window.removeEventListener('scroll', this.onScroll, { capture: true })
            window.removeEventListener('pointermove', this.onPointerMove)
        }
        this.canvas?.remove()
        this.canvas = null
        this.ctx = null
    }
}
