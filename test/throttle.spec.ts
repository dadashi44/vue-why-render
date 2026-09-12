import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { throttle } from '../src/utils/throttle'

describe('throttle', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(0)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('пропускает первый вызов сразу', () => {
        const fn = vi.fn()
        throttle(fn, 100)()
        expect(fn).toHaveBeenCalledTimes(1)
    })

    it('схлопывает частые вызовы в один отложенный', () => {
        const fn = vi.fn()
        const throttled = throttle(fn, 100)

        throttled()
        throttled()
        throttled()
        expect(fn).toHaveBeenCalledTimes(1)

        vi.advanceTimersByTime(100)
        expect(fn).toHaveBeenCalledTimes(2)
    })

    it('отдаёт в колбэк последние аргументы', () => {
        const fn = vi.fn()
        const throttled = throttle(fn, 100)

        throttled('a')
        throttled('b')
        throttled('c')
        vi.advanceTimersByTime(100)
        expect(fn).toHaveBeenLastCalledWith('c')
    })

    it('при нулевой задержке зовёт синхронно каждый раз', () => {
        const fn = vi.fn()
        const throttled = throttle(fn, 0)
        throttled()
        throttled()
        expect(fn).toHaveBeenCalledTimes(2)
    })

    it('cancel отменяет отложенный вызов', () => {
        const fn = vi.fn()
        const throttled = throttle(fn, 100)
        throttled()
        throttled()
        throttled.cancel()

        vi.advanceTimersByTime(500)
        expect(fn).toHaveBeenCalledTimes(1)
    })

    it('flush выполняет отложенный вызов немедленно', () => {
        const fn = vi.fn()
        const throttled = throttle(fn, 100)
        throttled()
        throttled()
        throttled.flush()
        expect(fn).toHaveBeenCalledTimes(2)
    })

    it('flush без ожидающего вызова ничего не делает', () => {
        const fn = vi.fn()
        const throttled = throttle(fn, 100)
        throttled.flush()
        expect(fn).not.toHaveBeenCalled()
    })
})
