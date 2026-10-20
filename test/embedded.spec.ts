import { afterEach, describe, expect, it } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import type { App } from 'vue'
import { scan } from '../src/index'
import type { ScanHandle } from '../src/index'

let app: App | null = null
let handle: ScanHandle | null = null

afterEach(() => {
    handle?.stop()
    app = null
    handle = null
    document.body.innerHTML = ''
})

function start() {
    app = createApp(defineComponent({ render: () => h('div') }))
    handle = scan(app, { panel: false, overlay: false, devtools: false })!
    return window.__VUE_WHY_RENDER__!
}

describe('встроенная панель через window.__VUE_WHY_RENDER__.mountPanel', () => {
    it('монтируется в контейнер, а не плавает в body', async () => {
        const target = document.createElement('section')
        document.body.appendChild(target)
        start().mountPanel(target)
        await nextTick()

        const host = target.querySelector('[data-vue-why-render="panel-embedded"]') as HTMLElement
        expect(host).not.toBeNull()
        expect(host.style.height).toBe('100%')
        const panel = host.shadowRoot!.querySelector('.vwr')!
        expect(panel.classList).toContain('vwr--embedded')
        expect(panel.getAttribute('style')).toBeNull()
    })

    it('клик по шапке не сворачивает: во вкладке сворачивать нечего', async () => {
        const target = document.createElement('div')
        document.body.appendChild(target)
        start().mountPanel(target)
        await nextTick()

        const shadow = target.querySelector('[data-vue-why-render="panel-embedded"]')!.shadowRoot!
        ;(shadow.querySelector('.vwr__head') as HTMLElement).click()
        await nextTick()
        expect(shadow.querySelector('.vwr__body')).not.toBeNull()
        expect(shadow.querySelector('.vwr__head')!.textContent).not.toContain('▼')
    })

    it('создаёт узлы документом контейнера — вкладка DevTools это другой документ', async () => {
        const other = document.implementation.createHTMLDocument('tab')
        const target = other.createElement('div')
        other.body.appendChild(target)
        start().mountPanel(target)
        await nextTick()

        const host = target.querySelector('[data-vue-why-render="panel-embedded"]')!
        expect(host.ownerDocument).toBe(other)
        expect(host.shadowRoot!.querySelector('.vwr__toolbar')).not.toBeNull()
    })

    it('возвращает функцию размонтирования', async () => {
        const target = document.createElement('div')
        document.body.appendChild(target)
        const unmount = start().mountPanel(target)
        await nextTick()
        unmount()
        expect(target.children).toHaveLength(0)
    })
})
