import type { Locale } from 'vue-why-render'

export interface SiteMessages {
    title: [string, string]
    lead: string
    demoHeading: string
    demoLead: string
    hintLabel: string
    hint: string
    filterPlaceholder: string
    clock: string
    tick: string
    staticNote: string
    /** Корзина на Pinia в демо. */
    addToCart: string
    cartLabel: string
    clearCart: string
    footer: string
    /** Подпись и адрес документации (относительный: работает и на github.io, и на домене). */
    docs: string
    docsHref: string
    /** Ссылка на страницу кейса (сам кейс пока только на русском). */
    caseLink: string
    /** Подпись языка в переключателе. */
    name: string
    /** Шапка. */
    nav: { docs: string, playground: string, caseStudy: string, changelog: string }
    languageLabel: string
    /** aria-label навигации в шапке. */
    navLabel: string
    /** Герой: строка над заголовком, кнопки, подпись окна. */
    heroNews: string
    readDocs: string
    tryHere: string
    /** aria-label кнопки копирования команды установки. */
    copyInstall: string
    copied: string
    heroCaption: string
    /** Цепочка причины: заголовок, подводка и подписи четырёх узлов. */
    chainHeading: string
    chainLead: string
    chainLabels: [string, string, string, string]
    /** Пять видов причин. */
    causesHeading: string
    causesLead: string
    /** Таймлайн «до/после» на данных кейса. */
    timelineHeading: string
    timelineLead: string
    before: string
    after: string
    rendersLabel: string
    scenarioHome: string
    scenarioQuery: string
    noteBefore: string
    noteAfter: string
    readCase: string
    /** Путь: заметил, отчёт, тест, бюджет. */
    pathHeading: string
    path: { title: string, text: string }[]
    /** ИИ-агенты (MCP). */
    agentsHeading: string
    agentsLead: string
    agentsLink: string
}

export const siteLocales: Locale[] = ['en', 'ru', 'zh-CN']

export const site: Record<Locale, SiteMessages> = {
    'en': {
        name: 'English',
        title: ['See which components', 're‑render — and why'],
        lead: 'Other tools flash a border around a component that just updated. That is enough to notice a problem, but not to fix it — you are still left asking what actually changed. vue-why-render answers that: it names the exact reactive dependency that triggered the render.',
        demoHeading: 'Live playground',
        demoLead: 'The panel in the bottom-right corner is the real thing — it is scanning this very part of the page. Everything below is ordinary Vue components.',
        hintLabel: 'What to do:',
        hint: 'type in the field — only the list re-renders, the clock next to it stays untouched. Then hit +100 and find the badge line in the panel: the prop changes on every render even though the value inside it is the same. That is the most common source of wasted renders — and the 💡 line right under it says what to do about it. Finally, add something to the cart: the reason under CartSummary names the Pinia store, the field and the action that changed it.',
        filterPlaceholder: 'filter by title',
        clock: 'clock:',
        tick: 'tick:',
        staticNote: 'This component never re-renders — it will stay without a counter in the panel.',
        addToCart: 'Add to cart',
        cartLabel: 'Cart:',
        clearCart: 'clear',
        footer: 'MIT',
        docs: 'Docs',
        docsHref: 'docs/',
        caseLink: 'case study (ru)',
        nav: { docs: 'Docs', playground: 'Playground', caseStudy: 'Case study', changelog: 'Changelog' },
        languageLabel: 'Language',
        navLabel: 'Main',
        heroNews: 'v0.9.0 — now talks to AI agents over MCP',
        readDocs: 'Read the docs',
        tryHere: 'Try it on this page',
        copyInstall: 'Copy the install command',
        copied: 'Copied',
        heroCaption: 'The real panel runs on this page, in the bottom-right corner. You can collapse it or drag it aside.',
        chainHeading: 'Every re-render has a cause. Read it.',
        chainLead: 'vue-why-render follows the change from the line that made it to the component that redrew, and prints the whole path.',
        chainLabels: ['your code', 'store', 'computed', 'rendered'],
        causesHeading: 'Five kinds of cause, named plainly',
        causesLead: 'Vue knows why a component updated. vue-why-render keeps that answer and shows it next to the render, with the value before and after.',
        timelineHeading: 'Find the extra renders. Prove they are gone.',
        timelineLead: 'Record what your Vue app renders while you click around, fix the cause it names, and compare the two recordings side by side.',
        before: 'Before fix',
        after: 'After fix',
        rendersLabel: 'renders',
        scenarioHome: '60 seconds on the home page',
        scenarioQuery: '10 query changes',
        noteBefore: '−98% renders, −98% time. Cause: route query.utm_campaign.',
        noteAfter: 'navbar, ui-logo, footer: ×40 → ×0',
        readCase: 'Read the case study (ru)',
        pathHeading: 'From a hunch to a number your CI checks',
        path: [
            { title: 'Spot it', text: 'Outlines and counters on the page. Hot components turn orange.' },
            { title: 'Save a report', text: 'Record a session, then compare it with the one after your fix.' },
            { title: 'Pin it in a test', text: 'expectRenders(Card).toBe(1) in Vitest.' },
            { title: 'Set a budget', text: 'CI fails when a page renders more than you allowed.' },
        ],
        agentsHeading: 'Your AI agent can read it too',
        agentsLead: 'vue-why-render-mcp hands the live report to Claude Code, Cursor or any MCP client, so the agent sees the render causes instead of guessing.',
        agentsLink: 'Set up MCP',
    },

    'ru': {
        name: 'Русский',
        title: ['Видно, какие компоненты', 'перерисовываются — и почему'],
        lead: 'Аналоги умеют мигать рамкой вокруг обновившегося компонента. Этого хватает, чтобы заметить проблему, но не чтобы её починить: остаётся вопрос «а что вообще изменилось?». vue-why-render отвечает на него — называет конкретную реактивную зависимость, которая дёрнула рендер.',
        demoHeading: 'Живая песочница',
        demoLead: 'Панель справа внизу — настоящая, она сканирует этот же кусок страницы. Всё, что ниже, обычные компоненты Vue.',
        hintLabel: 'Что делать:',
        hint: 'печатай в поле — перерисуется только список, а часы рядом останутся нетронутыми. Потом нажми +100 и найди в панели строку про badge: проп меняется каждый рендер, хотя значение в нём то же самое. Это и есть самый частый источник лишних рендеров, а строка 💡 под ним подскажет, что с этим делать. И напоследок положи что-нибудь в корзину: причина у CartSummary назовёт стор Pinia, поле и экшен, который его поменял.',
        filterPlaceholder: 'фильтр по названию',
        clock: 'часы:',
        tick: 'тик:',
        staticNote: 'Этот компонент не перерисовывается никогда — в панели он так и останется без счётчика.',
        addToCart: 'В корзину',
        cartLabel: 'Корзина:',
        clearCart: 'очистить',
        footer: 'MIT',
        docs: 'Документация',
        docsHref: 'docs/ru/',
        caseLink: 'кейс: аудит Nuxt-фронта',
        nav: { docs: 'Документация', playground: 'Песочница', caseStudy: 'Кейс', changelog: 'Список изменений' },
        languageLabel: 'Язык',
        navLabel: 'Основное меню',
        heroNews: 'v0.9.0 — теперь общается с ИИ-агентами по MCP',
        readDocs: 'Читать документацию',
        tryHere: 'Попробовать на этой странице',
        copyInstall: 'Скопировать команду установки',
        copied: 'Скопировано',
        heroCaption: 'На этой странице работает настоящая панель — она в правом нижнем углу. Её можно свернуть или перетащить в сторону.',
        chainHeading: 'У каждой перерисовки есть причина. Прочитайте её.',
        chainLead: 'vue-why-render прослеживает изменение от строки кода, которая его вызвала, до компонента, который перерисовался, и выводит весь путь.',
        chainLabels: ['ваш код', 'стор', 'computed', 'отрисован'],
        causesHeading: 'Пять видов причин — называем прямо',
        causesLead: 'Vue знает, почему компонент обновился. vue-why-render сохраняет этот ответ и показывает его рядом с рендером — со значением до и после.',
        timelineHeading: 'Найдите лишние рендеры. Докажите, что их больше нет.',
        timelineLead: 'Запишите, что рендерит приложение, пока вы по нему кликаете, исправьте названную причину и сравните две записи.',
        before: 'До исправления',
        after: 'После исправления',
        rendersLabel: 'рендеров',
        scenarioHome: '60 секунд на главной',
        scenarioQuery: '10 смен query',
        noteBefore: '−98% рендеров, −98% времени. Причина: route query.utm_campaign.',
        noteAfter: 'navbar, ui-logo, footer: ×40 → ×0',
        readCase: 'Читать кейс',
        pathHeading: 'От догадки до числа, которое проверяет CI',
        path: [
            { title: 'Заметить', text: 'Контуры и счётчики прямо на странице. Горячие компоненты становятся оранжевыми.' },
            { title: 'Сохранить отчёт', text: 'Запишите сессию и сравните её с записью после исправления.' },
            { title: 'Закрепить тестом', text: 'expectRenders(Card).toBe(1) в Vitest.' },
            { title: 'Задать бюджет', text: 'CI падает, если страница рендерится чаще, чем вы разрешили.' },
        ],
        agentsHeading: 'Ваш ИИ-агент тоже это прочитает',
        agentsLead: 'vue-why-render-mcp передаёт живой отчёт в Claude Code, Cursor или любой MCP-клиент: агент видит причины рендеров, а не гадает.',
        agentsLink: 'Подключить MCP',
    },

    'zh-CN': {
        name: '中文',
        title: ['看清哪些组件在重新渲染', '—— 以及究竟为什么'],
        lead: '同类工具会在刚更新的组件周围闪一圈边框。这足以让你发现问题，却不足以让你修好它 —— 你依然要问：到底是什么变了？vue-why-render 回答的正是这个问题：它会指出触发这次渲染的那个具体的响应式依赖。',
        demoHeading: '在线沙盒',
        demoLead: '右下角的面板是真实的 —— 它正在扫描这块页面本身。下面的全是普通的 Vue 组件。',
        hintLabel: '怎么玩：',
        hint: '在输入框里打字 —— 只有列表会重新渲染，旁边的时钟纹丝不动。然后点 +100，在面板里找到 badge 那一行：这个 prop 每次渲染都变，但里面的值完全没变。这正是多余渲染最常见的来源，而它下面的 💡 那一行会告诉你该怎么办。最后，往购物车里加点东西：CartSummary 下面的原因会指出是哪个 Pinia store、哪个字段，以及修改它的 action。',
        filterPlaceholder: '按名称过滤',
        clock: '时钟：',
        tick: '计数：',
        staticNote: '这个组件永远不会重新渲染 —— 它在面板里会一直没有计数。',
        addToCart: '加入购物车',
        cartLabel: '购物车：',
        clearCart: '清空',
        footer: 'MIT',
        docs: '文档',
        docsHref: 'docs/zh-cn/',
        caseLink: '案例（俄语）',
        nav: { docs: '文档', playground: '试玩', caseStudy: '案例', changelog: '更新日志' },
        languageLabel: '语言',
        navLabel: '主导航',
        heroNews: 'v0.9.0 —— 现已通过 MCP 对接 AI 智能体',
        readDocs: '阅读文档',
        tryHere: '在本页体验',
        copyInstall: '复制安装命令',
        copied: '已复制',
        heroCaption: '本页运行的是真实的面板，就在右下角。可以把它折叠起来，或拖到一旁。',
        chainHeading: '每一次重新渲染都有原因，直接读出来。',
        chainLead: 'vue-why-render 会顺着变化追踪：从引发它的那行代码，到重新绘制的组件，并打印出完整路径。',
        chainLabels: ['你的代码', 'store', 'computed', '已渲染'],
        causesHeading: '五类原因，一目了然',
        causesLead: 'Vue 知道组件为什么更新。vue-why-render 把这个答案留下来，和渲染并排展示，并给出变化前后的值。',
        timelineHeading: '找出多余的渲染，并证明它们已消失。',
        timelineLead: '录下你点来点去时应用的渲染情况，修掉它指出的原因，再把两次录制并排对比。',
        before: '修复前',
        after: '修复后',
        rendersLabel: '次渲染',
        scenarioHome: '首页停留 60 秒',
        scenarioQuery: '切换 10 次 query',
        noteBefore: '渲染次数 −98%，耗时 −98%。原因：route query.utm_campaign。',
        noteAfter: 'navbar、ui-logo、footer：×40 → ×0',
        readCase: '阅读案例（俄语）',
        pathHeading: '从直觉到 CI 能校验的数字',
        path: [
            { title: '发现', text: '页面上的轮廓和计数。热点组件会变成橙色。' },
            { title: '保存报告', text: '录制一次会话，再与修复后的会话对比。' },
            { title: '用测试固定', text: '在 Vitest 中写 expectRenders(Card).toBe(1)。' },
            { title: '设定预算', text: '页面渲染次数超出上限时，CI 直接失败。' },
        ],
        agentsHeading: '你的 AI 智能体也能读懂',
        agentsLead: 'vue-why-render-mcp 把实时报告交给 Claude Code、Cursor 或任何 MCP 客户端，智能体看到的是渲染原因，而不是靠猜。',
        agentsLink: '配置 MCP',
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
