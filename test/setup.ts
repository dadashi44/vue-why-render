import { beforeEach, vi } from 'vitest'

/**
 * jsdom не умеет canvas. Подсовываем контекст-заглушку, которая пишет вызовы,
 * чтобы оверлей можно было проверять без headless-браузера.
 */
export interface FakeContext {
    calls: Array<{ method: string, args: unknown[] }>
    strokeStyle: string
    fillStyle: string
    lineWidth: number
    font: string
    textBaseline: string
    strokeRect: (...args: unknown[]) => void
    fillRect: (...args: unknown[]) => void
    fillText: (...args: unknown[]) => void
    clearRect: (...args: unknown[]) => void
    setTransform: (...args: unknown[]) => void
    measureText: (text: string) => { width: number }
}

export function createFakeContext(): FakeContext {
    const calls: FakeContext['calls'] = []
    const record = (method: string) => (...args: unknown[]) => {
        calls.push({ method, args })
    }
    return {
        calls,
        strokeStyle: '',
        fillStyle: '',
        lineWidth: 0,
        font: '',
        textBaseline: '',
        strokeRect: record('strokeRect'),
        fillRect: record('fillRect'),
        fillText: record('fillText'),
        clearRect: record('clearRect'),
        setTransform: record('setTransform'),
        measureText: (text: string) => ({ width: text.length * 6 }),
    }
}

export let lastContext: FakeContext | null = null

beforeEach(() => {
    lastContext = null
    HTMLCanvasElement.prototype.getContext = vi.fn(() => {
        lastContext = createFakeContext()
        return lastContext as unknown as CanvasRenderingContext2D
    }) as unknown as HTMLCanvasElement['getContext']

    window.innerWidth = 1280
    window.innerHeight = 800
})

/** Прогнать один кадр rAF вручную. */
export function flushFrames(count = 1): void {
    for (let i = 0; i < count; i++) vi.advanceTimersByTime(16)
}
