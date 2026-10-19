/** Положение панели: отступы от правого и нижнего края окна, px. */
export interface PanelPosition {
    right: number
    bottom: number
}

interface Size {
    width: number
    height: number
}

const STORAGE_KEY = 'vue-why-render:panel-position'

/** Удержать панель целиком в окне. Больше окна — прижать к левому верхнему углу. */
export function clampPosition(position: PanelPosition, panel: Size, viewport: Size): PanelPosition {
    const clamp = (value: number, max: number): number => Math.min(Math.max(0, value), Math.max(0, max))
    return {
        right: clamp(position.right, viewport.width - panel.width),
        bottom: clamp(position.bottom, viewport.height - panel.height),
    }
}

/**
 * Сохранённая позиция или `null`. localStorage бывает недоступен: приватный
 * режим, запрет в настройках, песочница iframe — тогда панель просто стоит
 * на месте по умолчанию.
 */
export function loadPosition(): PanelPosition | null {
    try {
        const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
        if (!raw) return null
        const data = JSON.parse(raw) as Partial<PanelPosition>
        if (!Number.isFinite(data.right) || !Number.isFinite(data.bottom)) return null
        return { right: data.right as number, bottom: data.bottom as number }
    }
    catch {
        return null
    }
}

export function savePosition(position: PanelPosition): void {
    try {
        globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify({
            right: Math.round(position.right),
            bottom: Math.round(position.bottom),
        }))
    }
    catch {
        // Не сохранилось — значит, в следующий раз панель встанет в угол.
    }
}
