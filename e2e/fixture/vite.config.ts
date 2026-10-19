import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

/**
 * Стенд для e2e. Не песочница: там тикают часы и рендеры идут сами по себе,
 * а тесту нужно, чтобы каждый рендер был вызван им самим.
 * Пакет — из исходников по алиасу, как в песочнице.
 */
export default defineConfig({
    root: resolve(__dirname),
    plugins: [vue()],
    resolve: {
        alias: { 'vue-why-render': resolve(__dirname, '../../src/index.ts') },
    },
    server: { port: 5299, strictPort: true },
})
