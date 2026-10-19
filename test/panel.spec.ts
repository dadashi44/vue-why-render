import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Panel from '../src/panel/Panel.vue'
import { Scanner } from '../src/core/scanner'
import { resolveOptions } from '../src/options'
import type { RenderEvent, VueWhyRenderOptions } from '../src/types'

function makeScanner(locale?: 'en' | 'ru' | 'zh-CN', extra: VueWhyRenderOptions = {}): Scanner {
    return new Scanner(resolveOptions({
        enabled: true,
        overlay: false,
        panel: false,
        flushInterval: 0,
        ...(locale ? { locale } : {}),
        ...extra,
    }))
}

function event(uid: number, partial: Partial<RenderEvent> = {}): RenderEvent {
    return {
        uid,
        name: `C${uid}`,
        file: `/app/src/C${uid}.vue`,
        phase: 'update',
        duration: 2,
        fps: 60,
        timestamp: 1000 + uid,
        reasons: [],
        propChanges: [],
        ...partial,
    }
}

function seed(scanner: Scanner, uid: number, times = 1, partial: Partial<RenderEvent> = {}): void {
    scanner.registry.register({ uid, name: `C${uid}`, file: `/app/src/C${uid}.vue`, parentUid: null })
    for (let i = 0; i < times; i++) scanner.registry.record(event(uid, partial))
}

async function mountPanel(scanner: Scanner) {
    const wrapper = mount(Panel, { props: { scanner } })
    await wrapper.vm.$nextTick()
    return wrapper
}

let scanner: Scanner | null = null

afterEach(() => {
    scanner?.dispose()
    scanner = null
    vi.restoreAllMocks()
})

describe('Panel', () => {
    it('показывает заглушку, пока рендеров нет', async () => {
        scanner = makeScanner()
        const wrapper = await mountPanel(scanner)
        expect(wrapper.text()).toContain('No re-renders yet')
    })

    it('показывает топ по перерисовкам и обновляется на новые события', async () => {
        scanner = makeScanner()
        const wrapper = await mountPanel(scanner)

        seed(scanner, 1, 3)
        seed(scanner, 2, 1)
        await wrapper.vm.$nextTick()

        const rows = wrapper.findAll('.vwr__row')
        expect(rows).toHaveLength(2)
        expect(rows[0].text()).toContain('C1')
        expect(rows[0].text()).toContain('×3')
    })

    it('пишет причину последней перерисовки под строкой', async () => {
        scanner = makeScanner()
        seed(scanner, 1, 1, {
            reasons: [{ type: 'set', key: 'count', source: 'setup', oldValue: '0', newValue: '1' }],
        })
        const wrapper = await mountPanel(scanner)

        expect(wrapper.text()).toContain('state count: 0 → 1')
    })

    it('предупреждает про проп, у которого сменилась только ссылка', async () => {
        scanner = makeScanner()
        seed(scanner, 1, 1, {
            propChanges: [{ key: 'user', oldValue: '{ id }', newValue: '{ id }', referenceOnly: true, newFunction: false }],
        })
        const wrapper = await mountPanel(scanner)

        expect(wrapper.text()).toContain('new reference')
    })

    it('фильтрует список по запросу', async () => {
        scanner = makeScanner()
        seed(scanner, 1, 1)
        seed(scanner, 2, 1)
        const wrapper = await mountPanel(scanner)

        await wrapper.find('.vwr__search').setValue('C2')
        expect(wrapper.findAll('.vwr__row')).toHaveLength(1)
        expect(wrapper.find('.vwr__row').text()).toContain('C2')
    })

    it('переключает вкладки', async () => {
        scanner = makeScanner()
        seed(scanner, 1, 1, {
            reasons: [{ type: 'set', key: 'items', source: 'store' }],
        })
        const wrapper = await mountPanel(scanner)

        const tabs = wrapper.findAll('.vwr__tab')
        await tabs[3].trigger('click')

        expect(wrapper.text()).toContain('store items')
        expect(tabs[3].classes()).toContain('vwr__tab--active')
    })

    it('показывает дерево с суммой по поддереву', async () => {
        scanner = makeScanner()
        scanner.registry.register({ uid: 1, name: 'Parent', file: undefined, parentUid: null })
        scanner.registry.register({ uid: 2, name: 'Child', file: undefined, parentUid: 1 })
        scanner.registry.record(event(2, { name: 'Child' }))

        const wrapper = await mountPanel(scanner)
        await wrapper.findAll('.vwr__tab')[2].trigger('click')

        const rows = wrapper.findAll('.vwr__row')
        expect(rows[0].text()).toContain('Parent')
        expect(rows[0].text()).toContain('Σ1')
        expect(rows[1].text()).toContain('Child')
    })

    it('кнопка паузы останавливает запись', async () => {
        scanner = makeScanner()
        const wrapper = await mountPanel(scanner)

        await wrapper.findAll('.vwr__btn')[0].trigger('click')
        expect(scanner.registry.isPaused()).toBe(true)

        seed(scanner, 1, 1)
        await wrapper.vm.$nextTick()
        expect(wrapper.findAll('.vwr__row')).toHaveLength(0)
    })

    it('кнопка сброса обнуляет счётчики', async () => {
        scanner = makeScanner()
        seed(scanner, 1, 2)
        const wrapper = await mountPanel(scanner)
        expect(wrapper.findAll('.vwr__row')).toHaveLength(1)

        await wrapper.findAll('.vwr__btn')[1].trigger('click')
        expect(wrapper.findAll('.vwr__row')).toHaveLength(0)
        expect(scanner.registry.totalRenders).toBe(0)
    })

    it('по клику на строке зовёт дев-сервер, чтобы открыть файл в IDE', async () => {
        scanner = makeScanner()
        const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
        vi.stubGlobal('fetch', fetchMock)

        seed(scanner, 1, 1)
        const wrapper = await mountPanel(scanner)
        await wrapper.find('.vwr__row').trigger('click')

        expect(fetchMock).toHaveBeenCalledWith('/__open-in-editor?file=%2Fapp%2Fsrc%2FC1.vue')
        vi.unstubAllGlobals()
    })

    it('сворачивается по клику на заголовке', async () => {
        scanner = makeScanner()
        const wrapper = await mountPanel(scanner)

        expect(wrapper.find('.vwr__body').exists()).toBe(true)
        await wrapper.find('.vwr__head').trigger('click')
        expect(wrapper.find('.vwr__body').exists()).toBe(false)
    })

    it('отписывается от реестра при размонтировании', async () => {
        scanner = makeScanner()
        const wrapper = await mountPanel(scanner)
        wrapper.unmount()

        expect(() => scanner!.registry.record(event(1))).not.toThrow()
    })
})

describe('mountPanel', () => {
    it('монтирует панель в shadow DOM и убирает её по требованию', async () => {
        const { mountPanel: mountIntoShadow } = await import('../src/panel/mount')
        scanner = makeScanner()

        const unmount = mountIntoShadow(scanner)
        const host = document.querySelector<HTMLElement>('[data-vue-why-render="panel"]')

        expect(host).not.toBeNull()
        // Shadow DOM нужен, чтобы стили хост-приложения не текли в панель и наоборот.
        expect(host!.shadowRoot).not.toBeNull()
        expect(host!.shadowRoot!.querySelector('style')?.textContent).toContain('.vwr')
        expect(host!.shadowRoot!.querySelector('.vwr')).not.toBeNull()

        unmount()
        expect(document.querySelector('[data-vue-why-render="panel"]')).toBeNull()
    })
})

describe('Panel · локаль', () => {
    it('по умолчанию говорит по-английски', async () => {
        scanner = makeScanner()
        const wrapper = await mountPanel(scanner)

        expect(wrapper.text()).toContain('Top')
        expect(wrapper.text()).toContain('No re-renders yet')
    })

    it('переключается на язык из опции', async () => {
        scanner = makeScanner('ru')
        seed(scanner, 1, 1, {
            propChanges: [{ key: 'badge', oldValue: '{ text }', newValue: '{ text }', referenceOnly: true, newFunction: false }],
        })
        const wrapper = await mountPanel(scanner)

        expect(wrapper.text()).toContain('Топ')
        expect(wrapper.text()).toContain('новая ссылка, значение то же')
        expect(wrapper.text()).not.toContain('new reference')
    })

    it('понимает китайский', async () => {
        scanner = makeScanner('zh-CN')
        const wrapper = await mountPanel(scanner)

        expect(wrapper.text()).toContain('排行')
        expect(wrapper.text()).toContain('暂无重新渲染')
    })
})

describe('Panel: мелочи 0.5.0', () => {
    afterEach(() => {
        localStorage.clear()
    })

    it('кнопка паузы следует за паузой, включённой не из панели', async () => {
        scanner = makeScanner()
        const wrapper = await mountPanel(scanner)

        scanner.registry.setPaused(true)
        await wrapper.vm.$nextTick()
        const button = wrapper.findAll('.vwr__btn')[0]
        expect(button.text()).toBe('paused')
        expect(button.attributes('title')).toBe('pause / resume (Alt+Shift+P)')

        await button.trigger('click')
        expect(scanner.registry.isPaused()).toBe(false)
    })

    it('копирует причину строки', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined)
        vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
        scanner = makeScanner()
        seed(scanner, 1, 2, {
            reasons: [{ type: 'set', key: 'count', source: 'setup', oldValue: '0', newValue: '1' }],
        })
        const wrapper = await mountPanel(scanner)

        await wrapper.find('button.vwr__copy').trigger('click')
        await new Promise(resolve => setTimeout(resolve, 0))
        expect(writeText).toHaveBeenCalledWith('C1 ×2 · 2.0ms · src/C1.vue\n└─ state count: 0 → 1')
        expect(wrapper.find('button.vwr__copy').text()).toBe('✓')
        vi.unstubAllGlobals()
    })

    it('копирует отчёт Markdown-ом для issue', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined)
        vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
        scanner = makeScanner('ru')
        seed(scanner, 1, 3)
        const wrapper = await mountPanel(scanner)

        const button = wrapper.findAll('.vwr__btn').find(item => item.text() === 'md')!
        await button.trigger('click')
        await new Promise(resolve => setTimeout(resolve, 0))

        const text = writeText.mock.calls[0][0] as string
        expect(text).toContain('### vue-why-render report')
        // Даже при русской панели: смесь языков в issue читается хуже обоих.
        expect(text).toContain('#### Most re-rendered')
        expect(button.text()).toBe('✓')
        vi.unstubAllGlobals()
    })

    it('без причины кнопки копирования нет', async () => {
        scanner = makeScanner()
        seed(scanner, 1)
        const wrapper = await mountPanel(scanner)
        expect(wrapper.find('button.vwr__copy').exists()).toBe(false)
    })

    it('ставит класс темы из опции', async () => {
        scanner = makeScanner(undefined, { theme: 'light' })
        const wrapper = await mountPanel(scanner)
        expect(wrapper.find('.vwr').classes()).toContain('vwr--light')
    })

    it('по умолчанию тема следует системе', async () => {
        scanner = makeScanner()
        const wrapper = await mountPanel(scanner)
        expect(wrapper.find('.vwr').classes()).toContain('vwr--auto')
    })

    it('говорит в шапке, что счётчики выборочные', async () => {
        scanner = makeScanner(undefined, { sampleRate: 0.1 })
        const wrapper = await mountPanel(scanner)
        expect(wrapper.find('.vwr__head').text()).toContain('sample 10%')
    })

    it('перетаскивается за шапку, запоминает место и не сворачивается от переноса', async () => {
        scanner = makeScanner()
        const wrapper = await mountPanel(scanner)
        // В jsdom у элементов нулевой прямоугольник — ставим панель как в браузере:
        // 420×300 в правом нижнем углу окна 1280×800 с отступом 16.
        vi.spyOn(wrapper.find('.vwr').element, 'getBoundingClientRect').mockReturnValue(
            { left: 844, top: 484, right: 1264, bottom: 784, width: 420, height: 300, x: 844, y: 484 } as DOMRect,
        )
        const head = wrapper.find('.vwr__head')

        await head.trigger('pointerdown', { button: 0, clientX: 500, clientY: 500 })
        await head.trigger('pointermove', { clientX: 400, clientY: 450 })
        await head.trigger('pointerup')
        await head.trigger('click')

        const style = wrapper.find('.vwr').attributes('style')
        expect(style).toContain('right: 116px')
        expect(style).toContain('bottom: 66px')
        expect(wrapper.find('.vwr__body').exists()).toBe(true)
        expect(JSON.parse(localStorage.getItem('vue-why-render:panel-position')!)).toEqual({ right: 116, bottom: 66 })
    })

    it('дрожание руки при клике не считается переносом', async () => {
        scanner = makeScanner()
        const wrapper = await mountPanel(scanner)
        const head = wrapper.find('.vwr__head')

        await head.trigger('pointerdown', { button: 0, clientX: 500, clientY: 500 })
        await head.trigger('pointermove', { clientX: 502, clientY: 501 })
        await head.trigger('pointerup')
        await head.trigger('click')

        expect(wrapper.find('.vwr__body').exists()).toBe(false)
        expect(localStorage.getItem('vue-why-render:panel-position')).toBeNull()
    })

    it('встаёт на сохранённое место', async () => {
        localStorage.setItem('vue-why-render:panel-position', '{"right":40,"bottom":30}')
        scanner = makeScanner()
        const wrapper = await mountPanel(scanner)
        expect(wrapper.find('.vwr').attributes('style')).toContain('right: 40px')
    })
})
