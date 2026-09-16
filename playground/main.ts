import { createApp } from 'vue'
import VueWhyRender from 'vue-why-render'
import App from './App.vue'

const app = createApp(App)

app.use(VueWhyRender, {
    // Песочница подключает исходники по алиасу, мимо пребандлинга зависимостей,
    // поэтому NODE_ENV сюда не подставляется и режим надо задать руками.
    // У обычного потребителя, который ставит пакет из npm, это определяется само.
    enabled: true,
    // В песочнице интересно видеть и монтирования тоже.
    includeMounts: true,
    exclude: [/^RouterLink/],
})

app.mount('#app')
