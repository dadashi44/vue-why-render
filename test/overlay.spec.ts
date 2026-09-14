import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Overlay, heatColor } from '../src/overlay/canvas'
import { lastContext } from './setup'

let frames: FrameRequestCallback[] = []

function runFrame(times = 1): void {
    for (let i = 0; i < times; i++) {
        const queued = frames
        frames = []
        for (const frame of queued) frame(performance.now())
    }
}

function methods(): string[] {
    return (lastContext?.calls ?? []).map(call => call.method)
}

describe('heatColor', () => {
    it('на нуле зелёный, на единице красный', () => {
        expect(heatColor(0, 1)).toBe('rgba(60, 200, 90, 1)')
        expect(heatColor(1, 1)).toBe('rgba(255, 20, 90, 1)')
    })

    it('зажимает выход за границы', () => {
        expect(heatColor(-5, 1)).toBe(heatColor(0, 1))
        expect(heatColor(99, 1)).toBe(heatColor(1, 1))
    })

    it('прокидывает прозрачность', () => {
        expect(heatColor(0, 0.5)).toContain('0.5')
    })
})

describe('Overlay', () => {
    let overlay: Overlay | null = null

    beforeEach(() => {
        frames = []
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
            frames.push(cb)
            return frames.length
        })
        vi.stubGlobal('cancelAnimationFrame', vi.fn())
    })

    afterEach(() => {
        overlay?.dispose()
        overlay = null
        vi.unstubAllGlobals()
    })

    const bounds = { top: 10, left: 10, width: 100, height: 40 }

    it('добавляет canvas в body и помечает его', () => {
        overlay = new Overlay()
        const canvas = document.querySelector<HTMLCanvasElement>('canvas[data-vue-why-render="overlay"]')
        expect(canvas).not.toBeNull()
        expect(canvas!.style.pointerEvents).toBe('none')
    })

    it('рисует рамку после кадра', () => {
        overlay = new Overlay()
        overlay.highlight('1', bounds, 'Card ×1', 0.2)
        runFrame()
        expect(methods()).toContain('strokeRect')
    })

    it('рисует подпись, когда showLabels включён', () => {
        overlay = new Overlay({ showLabels: true })
        overlay.highlight('1', bounds, 'Card ×1', 0.2)
        runFrame()
        expect(methods()).toContain('fillText')
    })

    it('не рисует подпись, когда showLabels выключен', () => {
        overlay = new Overlay({ showLabels: false })
        overlay.highlight('1', bounds, 'Card ×1', 0.2)
        runFrame()
        expect(methods()).not.toContain('fillText')
    })

    it('не рисует то, что вне экрана', () => {
        overlay = new Overlay()
        overlay.highlight('1', { top: 9000, left: 0, width: 10, height: 10 }, 'Off', 0)
        runFrame()
        expect(methods()).not.toContain('strokeRect')
    })

    it('гасит рамку по истечении времени показа', () => {
        overlay = new Overlay({ displayDuration: 0, fadeInDuration: 0, fadeOutDuration: 0 })
        overlay.highlight('1', bounds, 'Card', 0)
        runFrame(3)

        lastContext!.calls.length = 0
        runFrame(2)
        expect(methods()).not.toContain('strokeRect')
    })

    it('clear убирает конкретную рамку', () => {
        overlay = new Overlay()
        overlay.highlight('1', bounds, 'Card', 0)
        overlay.clear('1')
        runFrame()
        expect(methods()).not.toContain('strokeRect')
    })

    it('dispose снимает canvas со страницы', () => {
        overlay = new Overlay()
        overlay.dispose()
        overlay = null
        expect(document.querySelector('canvas[data-vue-why-render="overlay"]')).toBeNull()
    })

    it('после dispose подсветка ничего не делает', () => {
        overlay = new Overlay()
        overlay.dispose()
        expect(() => overlay!.highlight('1', bounds, 'Card', 0)).not.toThrow()
    })

    it('не падает и не вешает canvas, если 2d-контекста нет', () => {
        HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext']
        overlay = new Overlay()
        overlay.highlight('1', bounds, 'Card', 0)
        expect(document.querySelector('canvas[data-vue-why-render="overlay"]')).toBeNull()
    })
})
