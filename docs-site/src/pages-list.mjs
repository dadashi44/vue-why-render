// Единый список страниц документации: из него строится меню
// (astro.config.mjs) и проверка полноты переводов (test/build.test.mjs).
export const sections = [
    {
        label: { en: 'Start', ru: 'Начало', 'zh-CN': '开始' },
        items: [
            { slug: 'index', label: { en: 'Introduction', ru: 'Введение', 'zh-CN': '简介' } },
            { slug: 'start/installation', label: { en: 'Installation', ru: 'Установка', 'zh-CN': '安装' } },
            { slug: 'start/vue', label: { en: 'Vue', ru: 'Vue', 'zh-CN': 'Vue' } },
            { slug: 'start/nuxt', label: { en: 'Nuxt', ru: 'Nuxt', 'zh-CN': 'Nuxt' } },
            { slug: 'start/manual', label: { en: 'Without the plugin', ru: 'Без плагина', 'zh-CN': '不使用插件' } },
        ],
    },
    {
        label: { en: 'Guides', ru: 'Руководства', 'zh-CN': '指南' },
        items: [
            { slug: 'guides/panel', label: { en: 'Panel and overlay', ru: 'Панель и оверлей', 'zh-CN': '面板与高亮层' } },
            { slug: 'guides/devtools', label: { en: 'Vue and Nuxt DevTools', ru: 'Vue и Nuxt DevTools', 'zh-CN': 'Vue 与 Nuxt DevTools' } },
            { slug: 'guides/pinia', label: { en: 'Pinia', ru: 'Pinia', 'zh-CN': 'Pinia' } },
            { slug: 'guides/router', label: { en: 'Vue Router', ru: 'Vue Router', 'zh-CN': 'Vue Router' } },
            { slug: 'guides/hints', label: { en: 'Hints', ru: 'Подсказки', 'zh-CN': '提示' } },
            { slug: 'guides/reports', label: { en: 'Reports', ru: 'Отчёты', 'zh-CN': '报告' } },
            { slug: 'guides/tests', label: { en: 'Render assertions in tests', ru: 'Проверки в тестах', 'zh-CN': '测试中的渲染断言' } },
            { slug: 'guides/budgets', label: { en: 'Budgets', ru: 'Бюджеты', 'zh-CN': '预算' } },
            { slug: 'guides/editor', label: { en: 'Opening files in your editor', ru: 'Открытие файлов в редакторе', 'zh-CN': '在编辑器中打开文件' } },
            { slug: 'guides/mcp', label: { en: 'AI agents (MCP)', ru: 'ИИ-агенты (MCP)', 'zh-CN': 'AI 代理 (MCP)' } },
            { slug: 'guides/vscode', label: { en: 'VS Code extension', ru: 'Расширение для VS Code', 'zh-CN': 'VS Code 扩展' } },
        ],
    },
]
