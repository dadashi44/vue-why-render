// Единый список страниц документации: из него строится меню
// (astro.config.mjs) и проверка полноты переводов (test/build.test.mjs).
export const sections = [
    {
        label: { en: 'Start', ru: 'Начало', 'zh-CN': '开始' },
        items: [
            { slug: 'index', label: { en: 'Introduction', ru: 'Введение', 'zh-CN': '简介' } },
        ],
    },
]
