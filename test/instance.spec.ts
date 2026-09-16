import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentInternalInstance } from 'vue'
import { createApp, defineComponent, h } from 'vue'
import { getComponentBounds, getComponentFile, getComponentName, isInViewport } from '../src/core/instance'

function fakeInstance(type: object, parent: unknown = {}): ComponentInternalInstance {
    return { type, parent } as ComponentInternalInstance
}

describe('getComponentName', () => {
    it('берёт name', () => {
        expect(getComponentName(fakeInstance({ name: 'Button' }))).toBe('Button')
    })

    it('берёт __name из script setup', () => {
        expect(getComponentName(fakeInstance({ __name: 'ProductCard' }))).toBe('ProductCard')
    })

    it('предпочитает displayName', () => {
        expect(getComponentName(fakeInstance({ displayName: 'Pretty', name: 'Ugly' }))).toBe('Pretty')
    })

    it('падает на имя файла, если имени нет', () => {
        expect(getComponentName(fakeInstance({ __file: '/src/components/UserCard.vue' }))).toBe('UserCard')
        expect(getComponentName(fakeInstance({ __file: 'C:\\app\\Win.vue' }))).toBe('Win')
    })

    it('называет корень App', () => {
        expect(getComponentName(fakeInstance({}, null))).toBe('App')
    })

    it('называет безымянного потомка Anonymous', () => {
        expect(getComponentName(fakeInstance({}))).toBe('Anonymous')
    })

    it('не падает на null', () => {
        expect(getComponentName(null)).toBe('Anonymous')
    })
})

describe('getComponentFile', () => {
    it('отдаёт __file', () => {
        expect(getComponentFile(fakeInstance({ __file: '/src/A.vue' }))).toBe('/src/A.vue')
    })

    it('отдаёт undefined, если сборщик его не проставил', () => {
        expect(getComponentFile(fakeInstance({}))).toBeUndefined()
        expect(getComponentFile(null)).toBeUndefined()
    })
})

describe('isInViewport', () => {
    it('видит прямоугольник на экране', () => {
        expect(isInViewport({ top: 10, left: 10, width: 100, height: 40 })).toBe(true)
    })

    it('отбрасывает нулевой размер', () => {
        expect(isInViewport({ top: 0, left: 0, width: 0, height: 0 })).toBe(false)
    })

    it('отбрасывает уехавшее вверх и вниз', () => {
        expect(isInViewport({ top: -100, left: 0, width: 50, height: 50 })).toBe(false)
        expect(isInViewport({ top: 5000, left: 0, width: 50, height: 50 })).toBe(false)
    })

    it('отбрасывает уехавшее вбок', () => {
        expect(isInViewport({ top: 0, left: 5000, width: 50, height: 50 })).toBe(false)
        expect(isInViewport({ top: 0, left: -200, width: 50, height: 50 })).toBe(false)
    })
})

describe('getComponentBounds', () => {
    const hosts: HTMLElement[] = []

    afterEach(() => {
        vi.restoreAllMocks()
        for (const host of hosts.splice(0)) host.remove()
    })

    function mountAndFindInstance(root: ReturnType<typeof defineComponent>): ComponentInternalInstance {
        const host = document.createElement('div')
        document.body.appendChild(host)
        hosts.push(host)
        const app = createApp(root)
        const vm = app.mount(host) as unknown as { $: ComponentInternalInstance }
        return vm.$
    }

    it('берёт прямоугольник корневого элемента', () => {
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
            top: 10, left: 20, width: 100, height: 50, right: 120, bottom: 60,
        } as DOMRect)

        const instance = mountAndFindInstance(defineComponent({ render: () => h('div') }))
        expect(getComponentBounds(instance)).toEqual({ top: 10, left: 20, width: 100, height: 50 })
    })

    it('объединяет прямоугольники детей у фрагмента', () => {
        const rects = new Map<string, DOMRect>([
            ['A', { top: 10, left: 10, width: 10, height: 10, right: 20, bottom: 20 } as DOMRect],
            ['B', { top: 40, left: 60, width: 20, height: 20, right: 80, bottom: 60 } as DOMRect],
        ])
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
            return rects.get(this.textContent ?? '') ?? ({
                top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0,
            } as DOMRect)
        })

        const instance = mountAndFindInstance(defineComponent({
            render: () => [h('span', 'A'), h('span', 'B')],
        }))

        expect(getComponentBounds(instance)).toEqual({ top: 10, left: 10, width: 70, height: 50 })
    })

    it('отдаёт нули, если элементов с размерами нет', () => {
        const instance = mountAndFindInstance(defineComponent({ render: () => null }))
        expect(getComponentBounds(instance)).toEqual({ top: 0, left: 0, width: 0, height: 0 })
    })
})

describe('getComponentName и папки с index.vue', () => {
    it('берёт имя каталога, когда файл называется index.vue', () => {
        // Компилятор Vue кладёт в __name «index», и в панели такие компоненты
        // выглядят как десяток одинаковых строк.
        expect(getComponentName(fakeInstance({
            __name: 'index',
            __file: '/app/components/navbar/index.vue',
        }))).toBe('navbar')
    })

    it('работает и когда имени нет вовсе', () => {
        expect(getComponentName(fakeInstance({
            __file: '/app/components/ui-button/index.vue',
        }))).toBe('ui-button')
    })

    it('осмысленное имя важнее пути', () => {
        expect(getComponentName(fakeInstance({
            name: 'UserCard',
            __file: '/app/components/navbar/index.vue',
        }))).toBe('UserCard')
    })

    it('обычные файлы по-прежнему берут имя файла', () => {
        expect(getComponentName(fakeInstance({
            __file: '/app/components/navbar/UserCard.vue',
        }))).toBe('UserCard')
    })

    it('не падает, если index.vue лежит в корне', () => {
        expect(getComponentName(fakeInstance({ __name: 'index', __file: 'index.vue' }))).toBe('index')
    })
})
