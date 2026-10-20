import { afterEach, describe, expect, it } from 'vitest'
import { computed, createApp, defineComponent, h, nextTick } from 'vue'
import type { App } from 'vue'
import { createMemoryHistory, createRouter, RouterView, useRoute } from 'vue-router'
import type { Router } from 'vue-router'
import { scan } from '../src/index'
import type { ScanHandle } from '../src/index'
import { describeRouteChange } from '../src/core/router'
import { hintsForRecord } from '../src/core/hints'
import { formatReason } from '../src/panel/format'
import { getMessages } from '../src/i18n'
import { resolveOptions } from '../src/options'
import type { RenderReason, VueWhyRenderOptions } from '../src/types'

/** На настоящем vue-router: где срабатывает реактивность маршрута — вопрос к нему, а не к моим догадкам. */

const ProductPage = defineComponent({
    name: 'ProductPage',
    setup: () => ({ route: useRoute() }),
    render() {
        return h('div', `${this.route.params.id} ${this.route.query.tab ?? ''}`)
    },
})

// Читает только путь — но через $route, то есть подписан на всю навигацию.
const PathHeader = defineComponent({
    name: 'PathHeader',
    render() {
        return h('header', this.$route.path)
    },
})

// То же поле, но через computed — query его не касается.
const IdBadge = defineComponent({
    name: 'IdBadge',
    setup() {
        const route = useRoute()
        return { id: computed(() => route.params.id) }
    },
    render() {
        return h('span', String(this.id))
    },
})

let app: App | null = null
let handle: ScanHandle | null = null
let router: Router | null = null

afterEach(() => {
    handle?.stop()
    app?.unmount()
    app = null
    handle = null
    router = null
})

async function start(options: VueWhyRenderOptions = {}) {
    router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', component: ProductPage, name: 'home' },
            { path: '/p/:id', component: ProductPage, name: 'product' },
            { path: '/about', component: { name: 'About', render: () => h('p', 'about') }, name: 'about' },
        ],
    })
    app = createApp(defineComponent({ name: 'Root', render: () => h('div', [h(PathHeader), h(IdBadge), h(RouterView)]) }))
    app.use(router)
    handle = scan(app, { panel: false, overlay: false, devtools: false, ...options })!
    await router.push('/p/1')
    await router.isReady()
    app.mount(document.createElement('div'))
    await nextTick()
}

async function navigate(to: string): Promise<Map<string, RenderReason[]>> {
    const before = handle!.getEvents().length
    await router!.push(to)
    await nextTick()
    const out = new Map<string, RenderReason[]>()
    for (const event of handle!.getEvents().slice(before)) out.set(event.name, event.reasons)
    return out
}

describe('Vue Router в причине', () => {
    it('смена параметра — params.id и пути до и после', async () => {
        await start()
        const reasons = await navigate('/p/42')
        expect(reasons.get('ProductPage')).toEqual([
            { type: 'set', key: 'params.id', source: 'route', oldValue: '"/p/1"', newValue: '"/p/42"' },
        ])
    })

    it('смена query — query.tab, а не путь', async () => {
        await start()
        const reasons = await navigate('/p/1?tab=reviews')
        expect(reasons.get('ProductPage')?.[0]).toMatchObject({ key: 'query.tab', newValue: '"/p/1?tab=reviews"' })
    })

    it('$route в шаблоне узнаётся так же, как useRoute()', async () => {
        await start()
        const reasons = await navigate('/p/1?tab=reviews')
        expect(reasons.get('PathHeader')?.[0]).toMatchObject({ source: 'route', key: 'query.tab' })
    })

    it('ушёл со страницы с параметром — params.id; между страницами без параметров — path', async () => {
        await start()
        const leaving = await navigate('/about')
        expect(leaving.get('PathHeader')?.[0].key).toBe('params.id')

        await navigate('/')
        const between = await navigate('/about')
        expect(between.get('PathHeader')?.[0]).toMatchObject({ key: 'path', oldValue: '"/"', newValue: '"/about"' })
    })

    it('ключ один на сколько угодно переходов — для диффа и бюджетов это одна причина', async () => {
        await start()
        const first = await navigate('/p/2')
        const second = await navigate('/p/3')
        expect(first.get('ProductPage')?.[0].key).toBe(second.get('ProductPage')?.[0].key)
    })

    it('computed от одного поля отсекает навигацию, которая это поле не меняет', async () => {
        await start()
        const query = await navigate('/p/1?tab=reviews')
        // Подсказка обещает именно это — проверяем, что обещание правда.
        expect(query.has('IdBadge')).toBe(false)
        expect(query.has('PathHeader')).toBe(true)

        const param = await navigate('/p/9')
        expect(param.get('IdBadge')?.[0]).toMatchObject({ source: 'computed', key: 'id' })
    })

    it('подсказывает обернуть поле в computed', async () => {
        await start()
        await navigate('/p/1?tab=reviews')
        const header = handle!.getStats().find(item => item.name === 'PathHeader')!
        expect(hintsForRecord(header, resolveOptions({ enabled: true })).map(hint => hint.code)).toContain('wholeRoute')
    })

    it('router: false — прежнее поведение', async () => {
        await start({ router: false })
        const reasons = await navigate('/p/42')
        expect(reasons.get('ProductPage')?.[0].source).not.toBe('route')
    })
})

describe('describeRouteChange', () => {
    it('называет все поменявшиеся части', () => {
        expect(describeRouteChange(
            { fullPath: '/p/1', path: '/p/1', params: { id: '1' }, query: {}, hash: '' },
            { fullPath: '/p/2?tab=a#top', path: '/p/2', params: { id: '2' }, query: { tab: 'a' }, hash: '#top' },
        )).toEqual({ key: 'params.id, query.tab, hash', from: '/p/1', to: '/p/2?tab=a#top' })
    })

    it('повторяющийся параметр сравнивает как массив', () => {
        expect(describeRouteChange(
            { path: '/t/a/b', params: { tags: ['a', 'b'] } },
            { path: '/t/a/b', params: { tags: ['a', 'b'] } },
        ).key).toBe('route')
        expect(describeRouteChange(
            { path: '/t/a', params: { tags: ['a'] } },
            { path: '/t/a/b', params: { tags: ['a', 'b'] } },
        ).key).toBe('params.tags')
    })

    it('сменилась только страница — path; только имя — name', () => {
        expect(describeRouteChange({ path: '/a', params: {} }, { path: '/b', params: {} }).key).toBe('path')
        expect(describeRouteChange({ path: '/a', name: 'x' }, { path: '/a', name: 'y' }).key).toBe('name')
    })

    it('переживает пустые значения', () => {
        expect(describeRouteChange(undefined, undefined)).toEqual({ key: 'route', from: '', to: '' })
    })
})

describe('formatReason с маршрутом', () => {
    it('маршрут, что поменялось, откуда и куда', () => {
        const reason: RenderReason = { type: 'set', key: 'params.id', source: 'route', oldValue: '"/p/1"', newValue: '"/p/42"' }
        expect(formatReason(reason, getMessages('en'))).toBe('route params.id: "/p/1" → "/p/42"')
        expect(formatReason(reason, getMessages('ru'))).toBe('маршрут params.id: "/p/1" → "/p/42"')
    })
})
