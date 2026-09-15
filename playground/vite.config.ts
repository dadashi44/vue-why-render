import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
    root: resolve(__dirname),
    plugins: [vue()],
    resolve: {
        alias: { 'vue-why-render': resolve(__dirname, '../src/index.ts') },
    },
})
