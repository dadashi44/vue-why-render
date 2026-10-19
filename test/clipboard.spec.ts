import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyToClipboard } from '../src/panel/clipboard'

type Exec = (command: string) => boolean

function stubExec(impl: Exec) {
    const exec = vi.fn(impl)
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true })
    return exec
}

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    delete (document as { execCommand?: unknown }).execCommand
})

describe('copyToClipboard', () => {
    it('пишет через navigator.clipboard, когда он есть', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined)
        vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
        expect(await copyToClipboard('hi')).toBe(true)
        expect(writeText).toHaveBeenCalledWith('hi')
    })

    it('без clipboard API (не HTTPS) копирует через textarea и execCommand и убирает её', async () => {
        vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
        let copied = ''
        const exec = stubExec((command) => {
            copied = (document.activeElement as HTMLTextAreaElement | null)?.value
                ?? document.querySelector('textarea')?.value ?? ''
            return command === 'copy'
        })

        expect(await copyToClipboard('line 1\nline 2')).toBe(true)
        expect(exec).toHaveBeenCalledWith('copy')
        expect(copied).toBe('line 1\nline 2')
        expect(document.querySelector('textarea')).toBeNull()
    })

    it('отказ clipboard API — тоже повод попробовать запасной путь', async () => {
        const writeText = vi.fn().mockRejectedValue(new Error('NotAllowedError'))
        vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
        stubExec(() => true)
        expect(await copyToClipboard('x')).toBe(true)
    })

    it('если не вышло ничего — false, а не исключение', async () => {
        vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
        stubExec(() => {
            throw new Error('not supported')
        })
        expect(await copyToClipboard('x')).toBe(false)
        expect(document.querySelector('textarea')).toBeNull()
    })
})
