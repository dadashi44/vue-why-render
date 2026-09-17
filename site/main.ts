import { createApp } from 'vue'
import VueWhyRender from 'vue-why-render'
import App from './App.vue'
import './styles.css'

const app = createApp(App)

app.use(VueWhyRender, {
    enabled: true,
    // На витрине интересно видеть и монтирования: посетитель открывает
    // страницу и сразу видит, что панель живая, а не пустая.
    includeMounts: true,
    // Обвязка лендинга — шум: в панели должны быть только демо-компоненты.
    // Anonymous — безымянный корневой рендер самого лендинга.
    exclude: [/^Site/, 'App', 'Anonymous'],
})

app.mount('#app')
