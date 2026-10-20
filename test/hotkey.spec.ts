import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import type { App } from 'vue'
import { bindHotkey, formatHotkey, isMac, matchesHotkey, parseHotkey } from '../src/utils/hotkey'
import { scan } from '../src/index'
import type { ScanHandle } from '../src/index'

function press(init: KeyboardEventInit): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
    window.dispatchEvent(event)
    return event
}

describe('parseHotkey', () => {
    it('разбирает модификаторы и клавишу без учёта регистра', () => {
        expect(parseHotkey('Alt+Shift+P')).toEqual({ key: 'p', alt: true, shift: true, ctrl: false, meta: false })
        expect(parseHotkey('cmd + k')).toEqual({ key: 'k', alt: false, shift: false, ctrl: false, meta: true })
    })

    it('отказывается от сочетания без клавиши или с двумя клавишами', () => {
        expect(parseHotkey('Alt+Shift')).toBeNull()
        expect(parseHotkey('P+Q')).toBeNull()
        expect(parseHotkey('Alt++P')).toBeNull()
        expect(parseHotkey('')).toBeNull()
    })
})

describe('matchesHotkey', () => {
    const hotkey = parseHotkey('Alt+Shift+P')!

    it('сверяет букву по code: на маке Alt превращает P в π', () => {
        const event = new KeyboardEvent('keydown', { key: 'π', code: 'KeyP', altKey: true, shiftKey: true })
        expect(matchesHotkey(event, hotkey)).toBe(true)
    })

    it('срабатывает в другой раскладке', () => {
        const event = new KeyboardEvent('keydown', { key: 'З', code: 'KeyP', altKey: true, shiftKey: true })
        expect(matchesHotkey(event, hotkey)).toBe(true)
    })

    it('требует точного набора модификаторов', () => {
        expect(matchesHotkey(new KeyboardEvent('keydown', { code: 'KeyP', altKey: true }), hotkey)).toBe(false)
        expect(matchesHotkey(
            new KeyboardEvent('keydown', { code: 'KeyP', altKey: true, shiftKey: true, ctrlKey: true }),
            hotkey,
        )).toBe(false)
    })

    it('не-буквенную клавишу сверяет по key', () => {
        expect(matchesHotkey(new KeyboardEvent('keydown', { key: 'F8' }), parseHotkey('F8')!)).toBe(true)
    })
})

describe('formatHotkey', () => {
    it('на маке — символами, как в меню системы', () => {
        expect(formatHotkey('Alt+Shift+P', true)).toBe('⌥⇧P')
        expect(formatHotkey('cmd+shift+k', true)).toBe('⇧⌘K')
        expect(formatHotkey('Ctrl+Alt+Shift+Meta+X', true)).toBe('⌃⌥⇧⌘X')
    })

    it('на остальных — словами через плюс, в привычном порядке', () => {
        expect(formatHotkey('Shift+Alt+P', false)).toBe('Alt+Shift+P')
        expect(formatHotkey('f8', false)).toBe('F8')
    })

    it('кривое сочетание показывает как есть', () => {
        expect(formatHotkey('Alt+Shift', true)).toBe('Alt+Shift')
    })
})

describe('isMac', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('узнаёт мак по userAgentData и по platform', () => {
        vi.stubGlobal('navigator', { userAgentData: { platform: 'macOS' } })
        expect(isMac()).toBe(true)
        vi.stubGlobal('navigator', { platform: 'MacIntel' })
        expect(isMac()).toBe(true)
        vi.stubGlobal('navigator', { platform: 'Win32' })
        expect(isMac()).toBe(false)
    })
})

describe('bindHotkey', () => {
    let unbind: (() => void) | null = null

    afterEach(() => {
        unbind?.()
        unbind = null
        vi.restoreAllMocks()
    })

    it('зовёт обработчик и гасит действие по умолчанию', () => {
        const handler = vi.fn()
        unbind = bindHotkey('Alt+Shift+P', handler)
        const event = press({ code: 'KeyP', altKey: true, shiftKey: true })
        expect(handler).toHaveBeenCalledTimes(1)
        expect(event.defaultPrevented).toBe(true)
    })

    it('не реагирует на автоповтор зажатой клавиши', () => {
        const handler = vi.fn()
        unbind = bindHotkey('Alt+Shift+P', handler)
        press({ code: 'KeyP', altKey: true, shiftKey: true, repeat: true })
        expect(handler).not.toHaveBeenCalled()
    })

    it('снимается', () => {
        const handler = vi.fn()
        bindHotkey('Alt+Shift+P', handler)()
        press({ code: 'KeyP', altKey: true, shiftKey: true })
        expect(handler).not.toHaveBeenCalled()
    })

    it('на кривое сочетание предупреждает и ничего не вешает', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const handler = vi.fn()
        unbind = bindHotkey('Alt+Shift', handler)
        press({ code: 'KeyP', altKey: true, shiftKey: true })
        expect(handler).not.toHaveBeenCalled()
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('Alt+Shift'))
    })
})

describe('пауза по клавише в scan()', () => {
    let app: App | null = null
    let handle: ScanHandle | null = null

    afterEach(() => {
        handle?.stop()
        app = null
        handle = null
    })

    const Root = defineComponent({ name: 'Root', render: () => h('div') })

    it('переключает паузу и снимается вместе со сканером', () => {
        app = createApp(Root)
        handle = scan(app, { panel: false, overlay: false, devtools: false })!

        press({ code: 'KeyP', altKey: true, shiftKey: true })
        expect(handle.scanner.registry.isPaused()).toBe(true)
        press({ code: 'KeyP', altKey: true, shiftKey: true })
        expect(handle.scanner.registry.isPaused()).toBe(false)

        const registry = handle.scanner.registry
        handle.stop()
        handle = null
        press({ code: 'KeyP', altKey: true, shiftKey: true })
        expect(registry.isPaused()).toBe(false)
    })

    it('pauseHotkey: false не вешает ничего', () => {
        app = createApp(Root)
        handle = scan(app, { panel: false, overlay: false, devtools: false, pauseHotkey: false })!
        press({ code: 'KeyP', altKey: true, shiftKey: true })
        expect(handle.scanner.registry.isPaused()).toBe(false)
    })
})
