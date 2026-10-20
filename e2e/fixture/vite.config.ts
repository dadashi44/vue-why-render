import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { buildDevtoolsTabPage, DEVTOOLS_TAB_ROUTE } from '../../src/devtools-tab'

/**
 * Стенд для e2e. Не песочница: там тикают часы и рендеры идут сами по себе,
 * а тесту нужно, чтобы каждый рендер был вызван им самим.
 * Пакет — из исходников по алиасу, как в песочнице.
 */
export default defineConfig({
    root: resolve(__dirname),
    plugins: [
        vue(),
        {
            // Та же страница вкладки, что отдаёт Nuxt-модуль, — чтобы e2e
            // проверяли её в настоящем браузере без настоящего Nuxt.
            name: 'devtools-tab',
            configureServer(server) {
                server.middlewares.use(DEVTOOLS_TAB_ROUTE, (_req, res) => {
                    res.setHeader('content-type', 'text/html; charset=utf-8')
                    res.end(buildDevtoolsTabPage())
                })
            },
        },
    ],
    resolve: {
        alias: { 'vue-why-render': resolve(__dirname, '../../src/index.ts') },
    },
    server: { port: 5299, strictPort: true },
})
