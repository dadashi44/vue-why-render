import type { Bounds } from '../core/instance'
import { isInViewport } from '../core/instance'

interface HighlightItem {
    bounds: Bounds
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
    private onViewportChange = (): void => this.resize()

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
        window.addEventListener('resize', this.onViewportChange, { passive: true })
        window.addEventListener('scroll', this.onViewportChange, { passive: true })
    }

    private resize(): void {
        if (!this.canvas || !this.ctx) return
        const dpr = window.devicePixelRatio || 1
        this.canvas.width = Math.floor(window.innerWidth * dpr)
        this.canvas.height = Math.floor(window.innerHeight * dpr)
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    highlight(id: string, bounds: Bounds, label: string, heat: number): void {
        if (this.disposed || !this.ctx) return
        if (!isInViewport(bounds)) return

        const now = Date.now()
        const existing = this.items.get(id)
        if (existing) {
            existing.bounds = bounds
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

        const now = Date.now()
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace'
        ctx.textBaseline = 'middle'

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
        }

        if (this.items.size > 0) this.schedule()
    }

    private drawBox(item: HighlightItem): void {
        const ctx = this.ctx
        if (!ctx) return
        const { bounds, opacity } = item

        ctx.strokeStyle = heatColor(item.heat, opacity)
        ctx.lineWidth = 1.5
        ctx.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height)

        if (!this.showLabels) return

        const padding = 4
        const height = 15
        const width = ctx.measureText(item.label).width + padding * 2
        // Если места сверху нет — кладём подпись внутрь рамки, иначе уедет за экран.
        const top = bounds.top > height ? bounds.top - height : bounds.top

        ctx.fillStyle = heatColor(item.heat, opacity * 0.9)
        ctx.fillRect(bounds.left, top, width, height)
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`
        ctx.fillText(item.label, bounds.left + padding, top + height / 2)
    }

    dispose(): void {
        this.disposed = true
        if (this.frame !== null && typeof cancelAnimationFrame !== 'undefined') {
            cancelAnimationFrame(this.frame)
        }
        this.frame = null
        this.items.clear()
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this.onViewportChange)
            window.removeEventListener('scroll', this.onViewportChange)
        }
        this.canvas?.remove()
        this.canvas = null
        this.ctx = null
    }
}
