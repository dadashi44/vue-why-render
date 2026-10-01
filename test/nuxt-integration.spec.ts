import { describe, expect, it } from 'vitest'
import { runWithNuxtContext } from '@nuxt/kit'
import whyRenderModule from '../src/nuxt'

/**
 * В отличие от nuxt.spec.ts здесь @nuxt/kit настоящий: проверяем, что модуль
 * проходит через defineNuxtModule и реально доносит плагин до nuxt.options.
 * Мок такого поймать не может — он не знает ни про проверку совместимости,
 * ни про то, что addPluginTemplate требует активного контекста Nuxt.
 */
interface FakeNuxt {
    options: {
        dev: boolean
        plugins: Array<{ src: string, mode?: string }>
        build: { transpile: unknown[], templates: Array<{ getContents: (ctx: unknown) => string | Promise<string> }> }
        modules: unknown[]
        _installedModules: unknown[]
    }
    _version: string
    version: string
    hooks: { hook: () => void }
    hook: () => void
    callHook: () => Promise<void>
}

function fakeNuxt(dev: boolean): FakeNuxt {
    return {
        options: {
            dev,
            plugins: [],
            build: { transpile: [], templates: [] },
            modules: [],
            _installedModules: [],
        },
        _version: '4.5.0',
        version: '4.5.0',
        hooks: { hook: () => {} },
        hook: () => {},
        callHook: async () => {},
    }
}

async function install(options: Record<string, unknown>, dev = true): Promise<FakeNuxt> {
    const nuxt = fakeNuxt(dev)
    await runWithNuxtContext(nuxt as never, () =>
        (whyRenderModule as unknown as (o: unknown, n: unknown) => Promise<void>)(options, nuxt))
    return nuxt
}

describe('nuxt-модуль на настоящем @nuxt/kit', () => {
    it('в деве регистрирует ровно один клиентский плагин', async () => {
        const nuxt = await install({})
        expect(nuxt.options.plugins).toHaveLength(1)
        expect(nuxt.options.plugins[0].mode).toBe('client')
        expect(nuxt.options.plugins[0].src).toContain('vue-why-render.client.mjs')
    })

    it('в прод-сборке не оставляет ни плагина, ни шаблона', async () => {
        const nuxt = await install({}, false)
        expect(nuxt.options.plugins).toHaveLength(0)
        expect(nuxt.options.build.templates).toHaveLength(0)
    })

    it('сгенерированный плагин зовёт scan и сохраняет регулярки', async () => {
        const nuxt = await install({ exclude: [/^Router/], includeMounts: true })
        const contents = await nuxt.options.build.templates[0].getContents({ nuxt })
        expect(contents).toContain("import { scan } from 'vue-why-render'")
        expect(contents).toContain("import { defineNuxtPlugin } from '#app'")
        expect(contents).toContain('scan(nuxtApp.vueApp, { "exclude": [/^Router/], "includeMounts": true })')
    })
})
