import { createApp } from 'vue'
import VueWhyRender from 'vue-why-render'
import App from './App.vue'

const app = createApp(App)

app.use(VueWhyRender, {
    // В песочнице интересно видеть и монтирования тоже.
    includeMounts: true,
    exclude: [/^RouterLink/],
})

app.mount('#app')
