/** Разобранная горячая клавиша: `Alt+Shift+P` → модификаторы и клавиша. */
export interface Hotkey {
    key: string
    alt: boolean
    shift: boolean
    ctrl: boolean
    meta: boolean
}

const MODIFIERS: Record<string, keyof Omit<Hotkey, 'key'>> = {
    alt: 'alt',
    option: 'alt',
    shift: 'shift',
    ctrl: 'ctrl',
    control: 'ctrl',
    meta: 'meta',
    cmd: 'meta',
    command: 'meta',
}

/**
 * Строка вида `Alt+Shift+P` в структуру. Без клавиши или с двумя клавишами —
 * `null`: молча повесить не то сочетание хуже, чем не повесить никакого.
 */
export function parseHotkey(spec: string): Hotkey | null {
    const hotkey: Hotkey = { key: '', alt: false, shift: false, ctrl: false, meta: false }

    for (const raw of spec.split('+')) {
        const part = raw.trim().toLowerCase()
        if (!part) return null
        const modifier = MODIFIERS[part]
        if (modifier) {
            hotkey[modifier] = true
            continue
        }
        if (hotkey.key) return null
        hotkey.key = part
    }

    return hotkey.key ? hotkey : null
}

/**
 * Совпадает ли нажатие с сочетанием.
 *
 * Буквы и цифры сверяются по `code`, а не по `key`: на маке Alt превращает
 * `P` в `π`, а в русской раскладке это вообще `З` — по `key` сочетание
 * срабатывало бы через раз.
 */
export function matchesHotkey(event: KeyboardEvent, hotkey: Hotkey): boolean {
    if (event.altKey !== hotkey.alt) return false
    if (event.shiftKey !== hotkey.shift) return false
    if (event.ctrlKey !== hotkey.ctrl) return false
    if (event.metaKey !== hotkey.meta) return false

    if (/^[a-z]$/.test(hotkey.key)) return event.code === `Key${hotkey.key.toUpperCase()}`
    if (/^\d$/.test(hotkey.key)) return event.code === `Digit${hotkey.key}`
    return event.key.toLowerCase() === hotkey.key
}

/**
 * Повесить сочетание на window. Возвращает функцию снятия; если сочетание
 * не разобралось — предупреждает один раз и ничего не вешает.
 */
export function bindHotkey(spec: string, handler: () => void): () => void {
    if (typeof window === 'undefined') return () => {}

    const hotkey = parseHotkey(spec)
    if (!hotkey) {
        console.warn(`[vue-why-render] pauseHotkey "${spec}" is not a valid shortcut, e.g. "Alt+Shift+P". No shortcut was bound.`)
        return () => {}
    }

    const onKeydown = (event: KeyboardEvent): void => {
        if (event.repeat || !matchesHotkey(event, hotkey)) return
        // Иначе в поле ввода под фокусом заодно напечатается символ.
        event.preventDefault()
        handler()
    }

    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
}

type Modifier = keyof Omit<Hotkey, 'key'>

/** Порядок модификаторов, привычный на обеих платформах: Ctrl, Alt, Shift, Meta. */
const MODIFIER_ORDER: Modifier[] = ['ctrl', 'alt', 'shift', 'meta']
const MAC_SYMBOLS: Record<Modifier, string> = { ctrl: '⌃', alt: '⌥', shift: '⇧', meta: '⌘' }
const PC_NAMES: Record<Modifier, string> = { ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', meta: 'Meta' }

/** Маковский ли это компьютер. userAgentData есть не везде — откатываемся на platform. */
export function isMac(): boolean {
    if (typeof navigator === 'undefined') return false
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
    const platform = nav.userAgentData?.platform || nav.platform || ''
    return /mac/i.test(platform)
}

/**
 * Сочетание для подписи: на маке — `⌥⇧P`, как в меню системы, на остальных —
 * `Alt+Shift+P`. Модификаторы — в привычном порядке платформы, а не в том,
 * в каком их написали в опции.
 */
export function formatHotkey(spec: string, mac = isMac()): string {
    const hotkey = parseHotkey(spec)
    if (!hotkey) return spec

    // Клавиша хранится в нижнем регистре: «p» → «P», «f8» → «F8».
    const key = hotkey.key.charAt(0).toUpperCase() + hotkey.key.slice(1)
    const held = MODIFIER_ORDER.filter(name => hotkey[name])
    return mac
        ? held.map(name => MAC_SYMBOLS[name]).join('') + key
        : [...held.map(name => PC_NAMES[name]), key].join('+')
}
