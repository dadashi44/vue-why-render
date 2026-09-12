const WINDOW_MS = 1000

/** Счётчик кадров по скользящему окну в секунду. */
export class FpsMeter {
    private frames: number[] = []
    private rafId: number | null = null

    start(): void {
        if (this.rafId !== null || typeof requestAnimationFrame === 'undefined') return
        const tick = (): void => {
            const now = performance.now()
            this.frames.push(now)
            const cutoff = now - WINDOW_MS
            while (this.frames.length > 0 && this.frames[0] < cutoff) this.frames.shift()
            this.rafId = requestAnimationFrame(tick)
        }
        this.rafId = requestAnimationFrame(tick)
    }

    stop(): void {
        if (this.rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
            cancelAnimationFrame(this.rafId)
        }
        this.rafId = null
        this.frames = []
    }

    /** -1, пока кадров не хватает для оценки. */
    value(): number {
        if (this.frames.length < 2) return -1
        return Math.round((this.frames.length * 1000) / WINDOW_MS)
    }
}
