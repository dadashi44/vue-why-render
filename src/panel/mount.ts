import { createApp, h } from 'vue'
import type { Scanner } from '../core/scanner'
import Panel from './Panel.vue'
import styles from './panel.css?inline'

/**
 * Панель живёт в shadow DOM отдельным Vue-приложением.
 * Отдельным — потому что глобальный миксин вешается на конкретное приложение,
 * так что панель не сканирует сама себя и не попадает в собственную статистику.
 */
export interface MountPanelOptions {
    /**
     * Куда монтировать. По умолчанию — в body страницы плавающей панелью.
     * С target панель встроенная: занимает контейнер целиком, не плавает и
     * не перетаскивается — так она живёт во вкладке Nuxt DevTools.
     */
    target?: Element
}

export function mountPanel(scanner: Scanner, options: MountPanelOptions = {}): () => void {
    if (typeof document === 'undefined') return () => {}

    // Документ берём у контейнера, а не глобальный: вкладка DevTools — это
    // другой документ (iframe), и узлы для него создаются его же фабрикой.
    const doc = options.target?.ownerDocument ?? document
    const embedded = Boolean(options.target)

    const host = doc.createElement('div')
    host.dataset.vueWhyRender = embedded ? 'panel-embedded' : 'panel'
    if (embedded) Object.assign(host.style, { display: 'block', height: '100%' })
    ;(options.target ?? doc.body).appendChild(host)

    const shadow = host.attachShadow({ mode: 'open' })
    const style = doc.createElement('style')
    style.textContent = styles
    shadow.appendChild(style)

    const container = doc.createElement('div')
    if (embedded) container.style.height = '100%'
    shadow.appendChild(container)

    const app = createApp({
        name: 'VueWhyRenderPanel',
        render: () => h(Panel, { scanner, embedded }),
    })
    app.mount(container)

    return () => {
        app.unmount()
        host.remove()
    }
}
