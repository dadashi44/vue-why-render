import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

/**
 * Сайт проекта: лендинг с живой песочницей внутри.
 * Пакет подключается по алиасу из исходников — витрина всегда показывает
 * то, что лежит в репозитории, а не последний опубликованный релиз.
 */
export default defineConfig({
    root: resolve(__dirname),
    // В CI base приходит из настроек Pages (на vue-why-render.js.org это корень);
    // дефолт — для локальной сборки под github.io/vue-why-render/.
    base: process.env.SITE_BASE ?? '/vue-why-render/',
    plugins: [vue()],
    resolve: {
        alias: { 'vue-why-render': resolve(__dirname, '../src/index.ts') },
    },
    build: {
        outDir: resolve(__dirname, '../dist-site'),
        emptyOutDir: true,
    },
})
