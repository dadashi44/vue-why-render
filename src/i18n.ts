import type { ReasonSource } from './types'
import type { HintCode } from './core/hints'

export type Locale = 'en' | 'ru' | 'zh-CN'

export interface Messages {
    /** Подписи источника причины: «проп title», «стор cart.items». */
    source: Record<ReasonSource, string>
    /** Пометка «объект пересоздан, а содержимое то же». */
    referenceOnly: string
    /** Пометка «обе стороны — функции»: две стрелки не равны никогда. */
    newFunction: string
    /** Подсказки. Формулируются версиями, а не диагнозами — см. core/hints.ts. */
    hints: Record<HintCode, string>
    /** Вкладки и управление панелью. */
    tabTop: string
    tabSlow: string
    tabTree: string
    tabEvents: string
    searchPlaceholder: string
    recording: string
    paused: string
    reset: string
    saveReport: string
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
        newFunction: ' — a new function every render',
        hints: {
            newReference: 'looks like this object is rebuilt in the parent — hoist it into a constant or a computed',
            newFunction: 'the handler is recreated every render — move it into a method',
            parentRender: 'the parent re-rendered it, its own data did not change — a candidate for v-memo',
        },
        tabTop: 'Top',
        tabSlow: 'Slow',
        tabTree: 'Tree',
        tabEvents: 'Events',
        searchPlaceholder: 'filter by name or file',
        recording: 'recording',
        paused: 'paused',
        reset: 'reset',
        saveReport: 'report',
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
        newFunction: ' — новая функция на каждый рендер',
        hints: {
            newReference: 'похоже, объект собирается заново в родителе — вынеси в константу или computed',
            newFunction: 'обработчик создаётся заново — подними его в метод',
            parentRender: 'перерисовал родитель, свои данные не менялись — кандидат на v-memo',
        },
        tabTop: 'Топ',
        tabSlow: 'Медленные',
        tabTree: 'Дерево',
        tabEvents: 'События',
        searchPlaceholder: 'фильтр по имени или файлу',
        recording: 'запись',
        paused: 'пауза',
        reset: 'сброс',
        saveReport: 'отчёт',
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
        newFunction: ' — 每次渲染都是新函数',
        hints: {
            newReference: '这个对象似乎在父组件中被重新创建 —— 可以提取为常量或 computed',
            newFunction: '处理函数每次渲染都重新创建 —— 把它提取为方法',
            parentRender: '由父组件触发的重新渲染，自身数据并未改变 —— 可以考虑 v-memo',
        },
        tabTop: '排行',
        tabSlow: '耗时',
        tabTree: '组件树',
        tabEvents: '事件',
        searchPlaceholder: '按名称或文件过滤',
        recording: '记录中',
        paused: '已暂停',
        reset: '重置',
        saveReport: '报告',
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
