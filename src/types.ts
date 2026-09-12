import type { ComponentInternalInstance } from 'vue'

/** Что именно заставило компонент перерисоваться. */
export interface RenderReason {
    /** Тип операции реактивности: set / add / delete / clear. */
    type: string
    /** Ключ, который изменился: имя пропа, имя рефа, индекс массива. */
    key: string
    /** Откуда ключ: проп, стор, локальное состояние. */
    source: ReasonSource
    /** Короткое превью старого значения, если движок его отдал. */
    oldValue?: string
    /** Короткое превью нового значения. */
    newValue?: string
}

export type ReasonSource = 'props' | 'setup' | 'data' | 'store' | 'array' | 'collection' | 'unknown'

/** Изменение пропа, найденное дифом между beforeUpdate и updated. */
export interface PropChange {
    key: string
    oldValue: string
    newValue: string
    /** Значение изменилось только по ссылке, но равно по содержимому — частая причина лишних рендеров. */
    referenceOnly: boolean
}

export type RenderPhase = 'mount' | 'update'

/** Одно событие рендера. */
export interface RenderEvent {
    uid: number
    name: string
    file?: string
    phase: RenderPhase
    /** Длительность цикла обновления в мс (для mount не измеряется). */
    duration: number
    /** FPS на момент события. */
    fps: number
    timestamp: number
    reasons: RenderReason[]
    propChanges: PropChange[]
}

/** Агрегированная запись по одному живому компоненту. */
export interface ComponentRecord {
    uid: number
    name: string
    file?: string
    parentUid: number | null
    mountedAt: number
    renderCount: number
    /** Счётчик за текущее окно подсветки — обнуляется по таймеру. */
    flashCount: number
    totalDuration: number
    maxDuration: number
    lastDuration: number
    lastRenderAt: number
    lastReasons: RenderReason[]
    lastPropChanges: PropChange[]
}

export type NameFilter = string | RegExp | ((name: string, file?: string) => boolean)

export interface VueWhyRenderOptions {
    /** Включить сканер. По умолчанию — только в деве. */
    enabled?: boolean
    /** Рисовать рамки вокруг перерисованных компонентов. */
    overlay?: boolean
    /** Показывать интерактивную панель. */
    panel?: boolean
    /** Показывать имя компонента на рамке. */
    showLabels?: boolean
    /** Подсвечивать первые монтирования, а не только обновления. */
    includeMounts?: boolean
    /**
     * Собирать причины перерисовки через renderTriggered.
     * Самая полезная фича пакета, но и самая дорогая: колбэк дёргается
     * на каждый триггер реактивности. Выключай, если профилируешь тайминги.
     */
    trackReasons?: boolean
    /** Диффать пропы между beforeUpdate и updated. */
    trackProps?: boolean
    /** Не трогать эти компоненты. */
    exclude?: NameFilter[]
    /** Следить только за этими компонентами. */
    include?: NameFilter[]
    /** Игнорировать обновления быстрее указанного времени в мс. */
    minDuration?: number
    /** Сколько рендеров в секунду считается «горячим» — влияет на цвет рамки. */
    hotThreshold?: number
    /** Размер кольцевого буфера событий. */
    maxEvents?: number
    /** Как часто панель забирает новый снимок данных, мс. */
    flushInterval?: number
    /** Через сколько мс гаснет рамка. */
    displayDuration?: number
    /** Шаблон ссылки на открытие файла в IDE. */
    openInEditorUrl?: string
    /** Колбэк на каждое событие рендера. */
    onRender?: (event: RenderEvent) => void
}

export type ResolvedOptions = Required<Omit<VueWhyRenderOptions, 'onRender'>> & {
    onRender?: (event: RenderEvent) => void
}

/** Внутренние поля, которые мы вешаем на инстанс компонента. */
export interface TrackedInstance extends ComponentInternalInstance {
    __vwr?: {
        uid: number
        name: string
        file?: string
        tracked: boolean
        renderStart: number
        reasons: RenderReason[]
        propsSnapshot: Record<string, unknown> | null
        flashTimer: ReturnType<typeof setTimeout> | null
    }
}
