import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueWhyRender from 'vue-why-render'
import type { PanelTheme, VueWhyRenderOptions } from 'vue-why-render'
import App from './App.vue'

// Опции — из адресной строки: каждому тесту свой стенд без пересборки.
const params = new URLSearchParams(location.search)
const options: VueWhyRenderOptions = { enabled: true }
if (params.has('budget')) options.budgets = { maxRenders: Number(params.get('budget')) }
if (params.has('theme')) options.theme = params.get('theme') as PanelTheme

const app = createApp(App)
app.use(createPinia())
app.use(VueWhyRender, options)
app.mount('#app')
