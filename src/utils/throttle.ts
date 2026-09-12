export interface Throttled<T extends unknown[]> {
    (...args: T): void
    cancel: () => void
    flush: () => void
}

/**
 * Trailing-throttle: первый вызов проходит сразу, остальные схлопываются
 * в один отложенный. Нужен, чтобы панель не перерисовывалась на каждый рендер.
 */
export function throttle<T extends unknown[]>(fn: (...args: T) => void, wait: number): Throttled<T> {
    let lastCall = Number.NEGATIVE_INFINITY
    let timer: ReturnType<typeof setTimeout> | null = null
    let pending: T | null = null

    const invoke = (args: T): void => {
        lastCall = Date.now()
        pending = null
        fn(...args)
    }

    const throttled = ((...args: T) => {
        if (wait <= 0) {
            invoke(args)
            return
        }
        const elapsed = Date.now() - lastCall
        pending = args
        if (elapsed >= wait && timer === null) {
            invoke(args)
            return
        }
        if (timer === null) {
            timer = setTimeout(() => {
                timer = null
                if (pending) invoke(pending)
            }, Math.max(0, wait - elapsed))
        }
    }) as Throttled<T>

    throttled.cancel = () => {
        if (timer !== null) clearTimeout(timer)
        timer = null
        pending = null
    }

    throttled.flush = () => {
        if (timer !== null) {
            clearTimeout(timer)
            timer = null
        }
        if (pending) invoke(pending)
    }

    return throttled
}
