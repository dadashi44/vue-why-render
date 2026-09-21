import type { ReasonSource } from './types'

export type Locale = 'en' | 'ru' | 'zh-CN'

export interface Messages {
    /** Подписи источника причины: «проп title», «стор cart.items». */
    source: Record<ReasonSource, string>
    /** Пометка «объект пересоздан, а содержимое то же». */
    referenceOnly: string
    /** Вкладки и управление панелью. */
    tabTop: string
    tabSlow: string
    tabTree: string
    tabEvents: string
    searchPlaceholder: string
    recording: string
    paused: string
    reset: string
    components: string
    emptyRenders: string
    emptyTree: string
    emptyEvents: string
}

/**
 * Словари интерфейса. Строк меньше двадцати, поэтому i18n-библиотека здесь
 * была бы зависимостью ради одного объекта — а пакет обещает их отсутствие.
 *
 * Английский по умолчанию: пакет опубликован в мировом реестре, и интерфейс
 * на другом языке отсекает аудиторию раньше, чем она поймёт, что он делает.
 */
export const messages: Record<Locale, Messages> = {
    'en': {
        source: {
            props: 'prop',
            setup: 'state',
            data: 'data',
            store: 'store',
            array: 'array',
            collection: 'collection',
            unknown: 'reactivity',
        },
        referenceOnly: ' — new reference, same value',
        tabTop: 'Top',
        tabSlow: 'Slow',
        tabTree: 'Tree',
        tabEvents: 'Events',
        searchPlaceholder: 'filter by name or file',
        recording: 'recording',
        paused: 'paused',
        reset: 'reset',
        components: 'comp.',
        emptyRenders: 'No re-renders yet',
        emptyTree: 'Tree is empty',
        emptyEvents: 'No events',
    },

    'ru': {
        source: {
            props: 'проп',
            setup: 'состояние',
            data: 'data',
            store: 'стор',
            array: 'массив',
            collection: 'коллекция',
            unknown: 'реактивность',
        },
        referenceOnly: ' — новая ссылка, значение то же',
        tabTop: 'Топ',
        tabSlow: 'Медленные',
        tabTree: 'Дерево',
        tabEvents: 'События',
        searchPlaceholder: 'фильтр по имени или файлу',
        recording: 'запись',
        paused: 'пауза',
        reset: 'сброс',
        components: 'комп.',
        emptyRenders: 'Пока ни одной перерисовки',
        emptyTree: 'Дерево пустое',
        emptyEvents: 'Событий нет',
    },

    'zh-CN': {
        source: {
            props: 'prop',
            setup: '状态',
            data: 'data',
            store: 'store',
            array: '数组',
            collection: '集合',
            unknown: '响应式',
        },
        referenceOnly: ' — 新引用，值未变',
        tabTop: '排行',
        tabSlow: '耗时',
        tabTree: '组件树',
        tabEvents: '事件',
        searchPlaceholder: '按名称或文件过滤',
        recording: '记录中',
        paused: '已暂停',
        reset: '重置',
        components: '个组件',
        emptyRenders: '暂无重新渲染',
        emptyTree: '组件树为空',
        emptyEvents: '暂无事件',
    },
}

/** Неизвестная локаль не повод падать — инструмент отладки не имеет права ронять приложение. */
export function getMessages(locale: Locale): Messages {
    return messages[locale] ?? messages.en
}
