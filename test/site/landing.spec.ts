import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import type { App as VueApp } from 'vue'
import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import VueWhyRender, { getScanHandle } from '../../src/index'
import App from '../../site/App.vue'
import SiteHeader from '../../site/components/SiteHeader.vue'
import SiteHero from '../../site/components/SiteHero.vue'
import { site } from '../../site/i18n'

let app: VueApp | null = null
let host: HTMLElement | null = null

afterEach(() => {
    getScanHandle()?.stop()
    app?.unmount()
    host?.remove()
    app = null
    host = null
    vi.useRealTimers()
})

describe('landing', () => {
    it('panel sees playground components but no Site* ones', async () => {
        host = document.createElement('div')
        document.body.appendChild(host)
        app = createApp(App)
        app.use(createPinia())
        // Те же опции, что в site/main.ts.
        app.use(VueWhyRender, { enabled: true, includeMounts: true, exclude: [/^Site/, 'App', 'Anonymous'] })
        app.mount(host)
        await flushPromises()

        const names = getScanHandle()!.getStats().map(record => record.name)
        expect(names).toContain('ProductCard')
        expect(names.some(name => name.startsWith('Site'))).toBe(false)
        // Сами Site-компоненты при этом на странице есть.
        expect(host.querySelector('.site-header')).not.toBeNull()
        expect(host.querySelector('.site-hero')).not.toBeNull()
    })

    it('header links', async () => {
        const wrapper = mount(SiteHeader, { props: { t: site.ru, locale: 'ru' } })
        const hrefOf = (text: string) => wrapper.findAll('a').find(link => link.text().startsWith(text))?.attributes('href')

        expect(hrefOf(site.ru.nav.docs)).toBe('docs/ru/')
        expect(hrefOf(site.ru.nav.changelog)).toBe('https://github.com/dadashi44/vue-why-render/blob/main/CHANGELOG.md')
        expect(hrefOf(site.ru.nav.playground)).toBe('#demo')
        expect(hrefOf(site.ru.nav.caseStudy)).toBe('cases/bigplay/')
        expect(hrefOf('GitHub')).toBe('https://github.com/dadashi44/vue-why-render')

        expect(wrapper.find('nav').attributes('aria-label')).toBe(site.ru.navLabel)

        await wrapper.find('select').setValue('en')
        expect(wrapper.emitted('switch-locale')).toEqual([['en']])
    })

    it('copy button writes the install command', async () => {
        vi.useFakeTimers()
        const writeText = vi.fn(() => Promise.resolve())
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

        const wrapper = mount(SiteHero, { props: { t: site.en } })
        const button = wrapper.find('button.hero-install__copy')
        const status = wrapper.find('[role="status"]')
        expect(button.attributes('aria-label')).toBe(site.en.copyInstall)
        expect(status.attributes('aria-live')).toBe('polite')
        expect(status.text()).toBe('')

        await button.trigger('click')
        await flushPromises()
        expect(writeText).toHaveBeenCalledWith('npm i -D vue-why-render')
        expect(button.attributes('aria-label')).toBe(site.en.copied)
        expect(button.text()).toContain(site.en.copied)
        expect(status.text()).toBe(site.en.copied)

        vi.advanceTimersByTime(1500)
        await flushPromises()
        expect(button.attributes('aria-label')).toBe(site.en.copyInstall)
        expect(status.text()).toBe('')
    })

    it('hero links', () => {
        const wrapper = mount(SiteHero, { props: { t: site['zh-CN'] } })
        const hrefs = wrapper.findAll('a').map(link => link.attributes('href'))
        expect(hrefs).toEqual(expect.arrayContaining(['docs/zh-cn/guides/mcp/', 'docs/zh-cn/', '#demo']))
    })

    it('reduced motion disables every animation class', () => {
        const css = readFileSync(resolve(__dirname, '../../site/styles.css'), 'utf8')
        const start = css.indexOf('@media (prefers-reduced-motion: reduce)')
        expect(start).toBeGreaterThan(-1)
        // Блок кончается на первой закрывающей скобке в начале строки.
        const end = css.indexOf('\n}', start)
        const block = css.slice(start, end)
        for (const name of ['wr-flash', 'wr-hot', 'wr-line', 'wr-node', 'wr-wire', 'wr-play']) {
            expect(block).toContain(`.${name}`)
        }
        // И блок такой один — все анимации выключаются в одном месте.
        expect(css.split('prefers-reduced-motion').length - 1).toBe(1)
    })

    it('en case-study link says the case is in Russian', () => {
        expect(site.en.readCase).toBe('Read the case study (ru)')
    })

    it('hero caption describes the panel truthfully, en title never breaks at the hyphen', () => {
        for (const locale of ['en', 'ru', 'zh-CN'] as const) expect(site[locale].heroCaption).not.toContain('Alt+R')
        expect(site.en.title.join(' ')).toContain('re\u2011render')
        expect(site.en.title.join(' ')).not.toContain('re-render')
    })
})
