import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueWhyRender from 'vue-why-render'
import App from './App.vue'
import { detectLocale } from './i18n'
// Шрифты лежат в сборке, без запросов на сторонний домен. Только latin и cyrillic:
// китайский текст берёт системный шрифт.
import '@fontsource/onest/latin-400.css'
import '@fontsource/onest/latin-500.css'
import '@fontsource/onest/latin-600.css'
import '@fontsource/onest/latin-700.css'
import '@fontsource/onest/cyrillic-400.css'
import '@fontsource/onest/cyrillic-500.css'
import '@fontsource/onest/cyrillic-600.css'
import '@fontsource/onest/cyrillic-700.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import '@fontsource/jetbrains-mono/cyrillic-400.css'
import '@fontsource/jetbrains-mono/cyrillic-500.css'
import './styles.css'

const app = createApp(App)
// Pinia — часть демо: панель показывает стор, поле и экшен в причине рендера.
app.use(createPinia())

app.use(VueWhyRender, {
    enabled: true,
    // Панель говорит на том же языке, что и страница.
    locale: detectLocale(),
    // На витрине интересно видеть и монтирования: посетитель открывает
    // страницу и сразу видит, что панель живая, а не пустая.
    includeMounts: true,
    // Обвязка лендинга — шум: в панели должны быть только демо-компоненты.
    // Anonymous — безымянный корневой рендер самого лендинга.
    exclude: [/^Site/, 'App', 'Anonymous'],
})

app.mount('#app')
