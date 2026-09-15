import { createApp, h } from 'vue'
import type { Scanner } from '../core/scanner'
import Panel from './Panel.vue'
import styles from './panel.css?inline'

/**
 * Панель живёт в shadow DOM отдельным Vue-приложением.
 * Отдельным — потому что глобальный миксин вешается на конкретное приложение,
 * так что панель не сканирует сама себя и не попадает в собственную статистику.
 */
export function mountPanel(scanner: Scanner): () => void {
    if (typeof document === 'undefined') return () => {}

    const host = document.createElement('div')
    host.dataset.vueWhyRender = 'panel'
    document.body.appendChild(host)

    const shadow = host.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = styles
    shadow.appendChild(style)

    const container = document.createElement('div')
    shadow.appendChild(container)

    const app = createApp({
        name: 'VueWhyRenderPanel',
        render: () => h(Panel, { scanner }),
    })
    app.mount(container)

    return () => {
        app.unmount()
        host.remove()
    }
}
