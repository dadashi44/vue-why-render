import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import {
    expectRenders,
    getRenderTracker,
    recordRenders,
    renderTracking,
    stopRenderTracking,
} from '../src/test'

afterEach(() => {
    stopRenderTracking()
})

/** Дочерний компонент, который зависит только от пропа badge. */
const ProductCard = defineComponent({
    name: 'ProductCard',
    props: { badge: { type: Object, required: true } },
    setup: props => () => h('div', { class: 'card' }, String((props.badge as { text: string }).text)),
})

const QuietChild = defineComponent({
    name: 'QuietChild',
    setup: () => () => h('span', 'quiet'),
})

/** Родитель, который каждый рендер отдаёт новый объект с тем же содержимым. */
function makeApp(stableBadge: boolean) {
    const badge = { text: 'sale' }
    return defineComponent({
        name: 'App',
        setup() {
            const count = ref(0)
            return { count, badge }
        },
        render() {
            return h('div', [
                h('button', { onClick: () => this.count++ }, `bump ${this.count}`),
                h(ProductCard, { badge: stableBadge ? this.badge : { text: 'sale' } }),
                h(QuietChild),
            ])
        },
    })
}

function mountTracked(stableBadge: boolean) {
    return mount(makeApp(stableBadge), {
        global: { plugins: [renderTracking()] },
    })
}

describe('renderTracking', () => {
    it('не трогает document: ни панели, ни оверлея', () => {
        mountTracked(true)
        expect(document.querySelectorAll('[data-vue-why-render]')).toHaveLength(0)
    })

    it('ставит активный трекер и снимает его', () => {
        mountTracked(true)
        expect(getRenderTracker()).not.toBeNull()
        stopRenderTracking()
        expect(getRenderTracker()).toBeNull()
    })

    it('без установки говорит, что делать, а не падает непонятно', async () => {
        await expect(recordRenders(() => {})).rejects.toThrow(/no render tracking is active/)
    })
})

describe('expectRenders', () => {
    it('ловит лишний рендер из-за нового объекта с тем же значением', async () => {
        const wrapper = mountTracked(false)

        await expect(
            expectRenders(ProductCard).toBe(0, () => wrapper.find('button').trigger('click')),
        ).rejects.toThrow(/expected ProductCard to re-render 0 time\(s\), but it re-rendered 1 time\(s\)/)
    })

    it('в сообщении об ошибке объясняет причину — ради этого всё и затевалось', async () => {
        const wrapper = mountTracked(false)

        await expect(
            expectRenders(ProductCard).toBe(0, () => wrapper.find('button').trigger('click')),
        ).rejects.toThrow(/new reference, same value/)
    })

    it('не повторяет причину и изменение пропа дважды', async () => {
        const wrapper = mountTracked(false)
        let message = ''
        try {
            await expectRenders(ProductCard).toBe(0, () => wrapper.find('button').trigger('click'))
        }
        catch (error) {
            message = (error as Error).message
        }
        // Одна строка про badge, а не две: «props badge» и «prop badge».
        expect(message.match(/badge/g)).toHaveLength(1)
        expect(message).toContain('new reference, same value')
    })

    it('проходит после починки: ссылка стабильна — рендера нет', async () => {
        const wrapper = mountTracked(true)

        await expectRenders(ProductCard).toBe(0, () => wrapper.find('button').trigger('click'))
    })

    it('считает несколько перерисовок', async () => {
        const wrapper = mountTracked(false)

        await expectRenders(ProductCard).toBe(3, async () => {
            await wrapper.find('button').trigger('click')
            await wrapper.find('button').trigger('click')
            await wrapper.find('button').trigger('click')
        })
    })

    it('toBeAtMost не придирается к точному числу', async () => {
        const wrapper = mountTracked(false)

        await expectRenders(ProductCard).toBeAtMost(5, async () => {
            await wrapper.find('button').trigger('click')
            await wrapper.find('button').trigger('click')
        })
    })

    it('toBeAtMost всё же падает, когда рендеров больше', async () => {
        const wrapper = mountTracked(false)

        await expect(
            expectRenders(ProductCard).toBeAtMost(1, async () => {
                await wrapper.find('button').trigger('click')
                await wrapper.find('button').trigger('click')
            }),
        ).rejects.toThrow(/at most 1 time\(s\), but it re-rendered 2/)
    })

    it('принимает имя строкой', async () => {
        const wrapper = mountTracked(false)
        await expectRenders('ProductCard').toBe(1, () => wrapper.find('button').trigger('click'))
    })

    it('принимает регулярку', async () => {
        const wrapper = mountTracked(false)
        await expectRenders(/^Product/).toBe(1, () => wrapper.find('button').trigger('click'))
    })

    it('не путает компоненты между собой', async () => {
        const wrapper = mountTracked(false)
        await expectRenders(QuietChild).toBe(0, () => wrapper.find('button').trigger('click'))
    })

    it('не считает монтирование перерисовкой', async () => {
        // Компонент появляется по v-if прямо внутри окна наблюдения.
        // Его первый рендер — монтирование, и лишним он не бывает.
        const Host = defineComponent({
            name: 'Host',
            setup() {
                const show = ref(false)
                return { show }
            },
            render() {
                return h('div', [
                    h('button', { onClick: () => { this.show = true } }, 'show'),
                    this.show ? h(QuietChild) : null,
                ])
            },
        })

        const wrapper = mount(Host, { global: { plugins: [renderTracking()] } })

        await expectRenders(QuietChild).toBe(0, () => wrapper.find('button').trigger('click'))
        // А сам он при этом действительно появился.
        expect(wrapper.find('span').exists()).toBe(true)
    })
})

describe('recordRenders', () => {
    it('отдаёт события окна целиком, включая причины', async () => {
        const wrapper = mountTracked(false)

        const events = await recordRenders(() => wrapper.find('button').trigger('click'))
        const names = events.map(event => event.name)

        expect(names).toContain('App')
        expect(names).toContain('ProductCard')
        expect(names).not.toContain('QuietChild')

        const card = events.find(event => event.name === 'ProductCard')!
        expect(card.propChanges[0]).toMatchObject({ key: 'badge', referenceOnly: true })
    })

    it('дожидается обновления — без nextTick окно было бы пустым', async () => {
        const wrapper = mountTracked(false)
        const events = await recordRenders(() => {
            // Намеренно без await: обновление Vue асинхронное.
            void wrapper.find('button').trigger('click')
        })
        expect(events.length).toBeGreaterThan(0)
    })
})
