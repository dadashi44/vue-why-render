import type { Locale } from 'vue-why-render'

export interface SiteMessages {
    tag: string
    title: [string, string]
    lead: string
    sampleReason: string
    sampleNote: string
    tryIt: string
    demoHeading: string
    demoLead: string
    hintLabel: string
    hint: string
    filterPlaceholder: string
    clock: string
    tick: string
    staticNote: string
    steps: [string, string, string]
    featuresHeading: string
    features: { title: string, text: string }[]
    installHeading: string
    installNote: [string, string, string]
    usageHeading: string
    usageNote: string
    footer: string
    sources: string
    /** Подпись языка в переключателе. */
    name: string
}

export const siteLocales: Locale[] = ['en', 'ru', 'zh-CN']

export const site: Record<Locale, SiteMessages> = {
    'en': {
        name: 'English',
        tag: 'Vue 3.3+ · no runtime dependencies',
        title: ['See which components', 're-render — and why'],
        lead: 'Other tools flash a border around a component that just updated. That is enough to notice a problem, but not to fix it — you are still left asking what actually changed. vue-why-render answers that: it names the exact reactive dependency that triggered the render.',
        sampleReason: 'new reference, same value',
        sampleNote: 'prop badge',
        tryIt: 'Try it live',
        demoHeading: 'Live playground',
        demoLead: 'The panel in the bottom-right corner is the real thing — it is scanning this very part of the page. Everything below is ordinary Vue components.',
        hintLabel: 'What to do:',
        hint: 'type in the field — only the list re-renders, the clock next to it stays untouched. Then hit +100 and find the badge line in the panel: the prop changes on every render even though the value inside it is the same. That is the most common source of wasted renders.',
        filterPlaceholder: 'filter by title',
        clock: 'clock:',
        tick: 'tick:',
        staticNote: 'This component never re-renders — it will stay without a counter in the panel.',
        steps: [
            'The panel header collapses and expands it.',
            'The tabs inside: top by renders, top by time, the tree, and the event feed.',
            'The border colour goes from green to red with frequency.',
        ],
        featuresHeading: 'What is inside',
        features: [
            { title: 'The reason, not the fact', text: 'The name of the prop, ref, store key or array index — plus the old and new value.' },
            { title: 'New reference, same value', text: 'A dedicated verdict for the most common source of wasted renders.' },
            { title: 'Overlay', text: 'A border around the re-rendered component, coloured green to red by frequency.' },
            { title: 'Panel', text: 'Top by render count and by time, a component tree with per-subtree totals, an event feed.' },
            { title: 'Jump to the editor', text: 'Clicking a row opens the SFC in your IDE through the dev server.' },
            { title: 'Your own reports', text: '<code>getStats()</code>, <code>getEvents()</code> and an <code>onRender</code> callback.' },
        ],
        installHeading: 'Install',
        installNote: [
            'Requires Vue 3.3+. No runtime dependencies. There is also the ',
            'npm page',
            ', and a tarball on the releases page if installing from the registry is not an option.',
        ],
        usageHeading: 'Usage',
        usageNote: 'The <code>import.meta.env.DEV</code> check is required: the package does not guess the build mode, and switching it off in production is the caller\'s job. In exchange, a static flag lets the bundler strip the import entirely.',
        footer: 'MIT',
        sources: 'source',
    },

    'ru': {
        name: 'Русский',
        tag: 'Vue 3.3+ · без рантайм-зависимостей',
        title: ['Видно, какие компоненты', 'перерисовываются — и почему'],
        lead: 'Аналоги умеют мигать рамкой вокруг обновившегося компонента. Этого хватает, чтобы заметить проблему, но не чтобы её починить: остаётся вопрос «а что вообще изменилось?». vue-why-render отвечает на него — называет конкретную реактивную зависимость, которая дёрнула рендер.',
        sampleReason: 'новая ссылка, значение то же',
        sampleNote: 'проп badge',
        tryIt: 'Попробовать вживую',
        demoHeading: 'Живая песочница',
        demoLead: 'Панель справа внизу — настоящая, она сканирует этот же кусок страницы. Всё, что ниже, обычные компоненты Vue.',
        hintLabel: 'Что делать:',
        hint: 'печатай в поле — перерисуется только список, а часы рядом останутся нетронутыми. Потом нажми +100 и найди в панели строку про badge: проп меняется каждый рендер, хотя значение в нём то же самое. Это и есть самый частый источник лишних рендеров.',
        filterPlaceholder: 'фильтр по названию',
        clock: 'часы:',
        tick: 'тик:',
        staticNote: 'Этот компонент не перерисовывается никогда — в панели он так и останется без счётчика.',
        steps: [
            'Заголовок панели сворачивает и разворачивает её.',
            'Вкладки внутри — топ по перерисовкам, топ по времени, дерево и лента событий.',
            'Цвет рамки вокруг компонента идёт от зелёного к красному по частоте.',
        ],
        featuresHeading: 'Что внутри',
        features: [
            { title: 'Причина, а не факт', text: 'Имя пропа, рефа, ключа стора или индекса массива — плюс старое и новое значение.' },
            { title: 'Новая ссылка, значение то же', text: 'Отдельная пометка для самого частого источника лишних рендеров.' },
            { title: 'Оверлей', text: 'Рамка вокруг перерисованного компонента, цвет — от зелёного к красному по частоте.' },
            { title: 'Панель', text: 'Топ по перерисовкам и по времени, дерево компонентов с суммой по поддереву, лента событий.' },
            { title: 'Прыжок в IDE', text: 'Клик по строке открывает SFC в редакторе через дев-сервер.' },
            { title: 'Свои отчёты', text: '<code>getStats()</code>, <code>getEvents()</code>, колбэк <code>onRender</code>.' },
        ],
        installHeading: 'Установка',
        installNote: [
            'Нужен Vue 3.3+. Рантайм-зависимостей нет. Есть и ',
            'страница в npm',
            ', и тарбол на странице релизов, если ставить из реестра нельзя.',
        ],
        usageHeading: 'Подключение',
        usageNote: 'Проверка на <code>import.meta.env.DEV</code> обязательна: пакет не определяет режим сборки сам, и гасить его в проде должен вызывающий код. Зато со статическим флагом сборщик вырезает и сам импорт.',
        footer: 'MIT',
        sources: 'исходники',
    },

    'zh-CN': {
        name: '中文',
        tag: 'Vue 3.3+ · 无运行时依赖',
        title: ['看清哪些组件在重新渲染', '—— 以及究竟为什么'],
        lead: '同类工具会在刚更新的组件周围闪一圈边框。这足以让你发现问题，却不足以让你修好它 —— 你依然要问：到底是什么变了？vue-why-render 回答的正是这个问题：它会指出触发这次渲染的那个具体的响应式依赖。',
        sampleReason: '新引用，值未变',
        sampleNote: 'prop badge',
        tryIt: '在线试用',
        demoHeading: '在线沙盒',
        demoLead: '右下角的面板是真实的 —— 它正在扫描这块页面本身。下面的全是普通的 Vue 组件。',
        hintLabel: '怎么玩：',
        hint: '在输入框里打字 —— 只有列表会重新渲染，旁边的时钟纹丝不动。然后点 +100，在面板里找到 badge 那一行：这个 prop 每次渲染都变，但里面的值完全没变。这正是多余渲染最常见的来源。',
        filterPlaceholder: '按名称过滤',
        clock: '时钟：',
        tick: '计数：',
        staticNote: '这个组件永远不会重新渲染 —— 它在面板里会一直没有计数。',
        steps: [
            '点击面板标题可折叠与展开。',
            '面板内的标签页：渲染次数排行、耗时排行、组件树与事件流。',
            '边框颜色随频率由绿转红。',
        ],
        featuresHeading: '功能',
        features: [
            { title: '给出原因，而非结果', text: 'prop、ref、store 键名或数组下标 —— 连同变更前后的值。' },
            { title: '新引用，值未变', text: '为多余渲染最常见的来源单独标注。' },
            { title: '高亮层', text: '在重新渲染的组件周围绘制边框，颜色按频率从绿到红。' },
            { title: '面板', text: '按次数与耗时排行、带子树合计的组件树、事件流。' },
            { title: '跳转到编辑器', text: '点击一行即可通过开发服务器在 IDE 中打开对应的 SFC。' },
            { title: '自建报表', text: '<code>getStats()</code>、<code>getEvents()</code> 以及 <code>onRender</code> 回调。' },
        ],
        installHeading: '安装',
        installNote: [
            '需要 Vue 3.3+，无运行时依赖。也可以访问 ',
            'npm 页面',
            '，或在无法从 registry 安装时使用发布页的 tarball。',
        ],
        usageHeading: '使用',
        usageNote: '<code>import.meta.env.DEV</code> 判断是必需的：本包不会自行猜测构建模式，在生产环境关掉它是调用方的责任。作为回报，静态标志能让打包器把 import 本身也一并消除。',
        footer: 'MIT',
        sources: '源码',
    },
}

/**
 * Язык берём из ?lang, иначе из настроек браузера. Выбор запоминаем в URL,
 * а не в localStorage: ссылкой на нужный язык тогда можно поделиться.
 */
export function detectLocale(): Locale {
    const fromQuery = new URLSearchParams(window.location.search).get('lang')
    if (fromQuery && siteLocales.includes(fromQuery as Locale)) return fromQuery as Locale

    const browser = navigator.language.toLowerCase()
    if (browser.startsWith('ru')) return 'ru'
    if (browser.startsWith('zh')) return 'zh-CN'
    return 'en'
}
