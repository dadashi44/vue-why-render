import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import vue from '@astrojs/vue'
import starlightLinksValidator from 'starlight-links-validator'
import { sections } from './src/pages-list.mjs'

const base = `${process.env.SITE_BASE ?? '/'}docs`.replace(/\/{2,}/g, '/')

// Меню из общего списка страниц: подписи берутся из переводов в самом списке.
const sidebar = sections.map((section) => ({
    label: section.label.en,
    translations: { ru: section.label.ru, 'zh-CN': section.label['zh-CN'] },
    items: section.items.map((item) => ({
        label: item.label.en,
        translations: { ru: item.label.ru, 'zh-CN': item.label['zh-CN'] },
        slug: item.slug === 'index' ? '' : item.slug,
    })),
}))

export default defineConfig({
    site: 'https://vue-why-render.js.org',
    base,
    outDir: '../dist-site/docs',
    integrations: [
        vue(),
        starlight({
            title: 'vue-why-render',
            logo: { src: './public/favicon.svg' },
            favicon: '/favicon.svg',
            defaultLocale: 'root',
            locales: {
                root: { label: 'English', lang: 'en' },
                ru: { label: 'Русский', lang: 'ru' },
                'zh-cn': { label: '简体中文', lang: 'zh-CN' },
            },
            social: [
                { icon: 'github', label: 'GitHub', href: 'https://github.com/dadashi44/vue-why-render' },
            ],
            sidebar,
            customCss: ['./src/styles/theme.css'],
            components: {
                ThemeProvider: './src/components/ThemeProvider.astro',
            },
            plugins: [starlightLinksValidator({ exclude: ['../', '../../'] })],
        }),
    ],
})
