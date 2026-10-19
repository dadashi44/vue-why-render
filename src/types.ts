import type { ComponentInternalInstance } from 'vue'
import type { Locale } from './i18n'

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
    /**
     * Обе стороны — функции. Две стрелки никогда не равны, поэтому
     * referenceOnly тут всегда false, и без отдельной пометки в панели
     * видны две одинаковые строки без объяснения, почему это изменение.
     */
    newFunction: boolean
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
    /**
     * Сколько из них были обновлениями, а не монтированием.
     * При includeMounts первый рендер — это монтирование, и выводы вида
     * «перерисовал родитель» по нему делать нельзя: компонент просто появился.
     */
    updateCount: number
    /** Счётчик за текущее окно подсветки — обнуляется по таймеру. */
    flashCount: number
    totalDuration: number
    maxDuration: number
    lastDuration: number
    lastRenderAt: number
    lastReasons: RenderReason[]
    lastPropChanges: PropChange[]
}

export type PanelTheme = 'auto' | 'dark' | 'light'

export type NameFilter = string | RegExp | ((name: string, file?: string) => boolean)

/**
 * Бюджет рендеров. Поля независимы: можно ограничить только частоту,
 * только длительность или обе сразу.
 */
export interface RenderBudget {
    /** К каким компонентам относится. Пусто — ко всем отслеживаемым. */
    include?: NameFilter[]
    /** Больше стольких рендеров одного инстанса за окно `per` — нарушение. */
    maxRenders?: number
    /** Окно для `maxRenders`, мс. По умолчанию 1000. */
    per?: number
    /** Обновление дольше стольких мс — нарушение. */
    maxDuration?: number
}

export type BudgetKind = 'renders' | 'duration'

/**
 * Нарушение бюджета. Одно на компонент и вид: горячий компонент нарушает
 * бюджет сотни раз в секунду, и список из сотни одинаковых строк ничего
 * не добавил бы к первой. Поэтому копится счётчик и худшее значение.
 */
export interface BudgetViolation {
    kind: BudgetKind
    /** Стабильный ключ `file::name`, как в отчёте. */
    key: string
    name: string
    file?: string
    limit: number
    /** Худшее увиденное значение: рендеров за окно или мс. */
    actual: number
    /** Окно в мс — только для `renders`. */
    per?: number
    /** Сколько раз бюджет был превышен. */
    count: number
    firstAt: number
    lastAt: number
    /** Причина рендера, на котором бюджет превышен впервые. */
    reason?: string
}

export interface VueWhyRenderOptions {
    /** Включить сканер. По умолчанию — только в деве. */
    enabled?: boolean
    /** Рисовать рамки вокруг перерисованных компонентов. */
    overlay?: boolean
    /** Показывать интерактивную панель. */
    panel?: boolean
    /**
     * Регистрировать инспектор и слой таймлайна в Vue DevTools.
     * Собственную панель не заменяет: расширение стоит не везде.
     */
    devtools?: boolean
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
    /** Язык интерфейса панели и подписей причин. По умолчанию `en`. */
    locale?: Locale
    /**
     * Доля событий, которые записываются, от 0 до 1. На паре тысяч компонентов
     * сам сканер начинает заметно стоить, и `0.1` пишет каждое десятое.
     * Счётчики тогда не абсолютные, а выборочные — панель и отчёт об этом говорят.
     */
    sampleRate?: number
    /** Горячая клавиша паузы, например `Alt+Shift+P`. `false` — без клавиши. */
    pauseHotkey?: string | false
    /** Тема панели. `auto` следует `prefers-color-scheme`. */
    theme?: PanelTheme
    /** Бюджеты рендеров: превышение пишется в консоль, в отчёт и в колбэк. */
    budgets?: RenderBudget | RenderBudget[]
    /** Колбэк на первое превышение бюджета каждым компонентом. */
    onBudgetExceeded?: (violation: BudgetViolation) => void
    /** Колбэк на каждое событие рендера. */
    onRender?: (event: RenderEvent) => void
}

export type ResolvedOptions = Required<Omit<VueWhyRenderOptions, 'onRender' | 'onBudgetExceeded' | 'budgets'>> & {
    /** Всегда массив: одиночный бюджет из опций заворачивается при разборе. */
    budgets: RenderBudget[]
    onRender?: (event: RenderEvent) => void
    onBudgetExceeded?: (violation: BudgetViolation) => void
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
