import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * @nuxt/kit подменяем целиком: настоящий defineNuxtModule тянет за собой
 * контекст сборки Nuxt, а проверить надо ровно две вещи — что модуль
 * добавляет плагин только в деве и что опции доезжают до него без потерь.
 */
const addPluginTemplate = vi.fn()
const addDevServerHandler = vi.fn()

vi.mock('@nuxt/kit', () => ({
    defineNuxtModule: (definition: unknown) => definition,
    addPluginTemplate: (...args: unknown[]) => addPluginTemplate(...args),
    addDevServerHandler: (...args: unknown[]) => addDevServerHandler(...args),
}))

const { buildPluginSource, serializeOptions } = await import('../src/nuxt')
const moduleDefinition = (await import('../src/nuxt')).default as unknown as {
    meta: { name: string, configKey: string }
    setup: (options: Record<string, unknown>, nuxt: { options: { dev: boolean }, hook: (name: string, fn: (...args: never[]) => unknown) => void }) => void
}

/** Подписки модуля на хуки Nuxt — по имени хука. */
let hooks = new Map<string, Array<(...args: never[]) => unknown>>()

function runSetup(options: Record<string, unknown>, dev = true): void {
    moduleDefinition.setup(options, {
        options: { dev },
        hook: (name, fn) => hooks.set(name, [...(hooks.get(name) ?? []), fn]),
    })
}

/** Вкладки, которые соберёт Nuxt DevTools, вызвав хук. */
function collectTabs(): Array<{ name: string, view: { src: string } }> {
    const tabs: Array<{ name: string, view: { src: string } }> = []
    for (const fn of hooks.get('devtools:customTabs') ?? []) (fn as (t: typeof tabs) => void)(tabs)
    return tabs
}

/** Последний исходник плагина, отданный в addPluginTemplate. */
function lastPluginSource(): string {
    const call = addPluginTemplate.mock.calls.at(-1)
    const template = call?.[0] as { getContents: () => string }
    return template.getContents()
}

beforeEach(() => {
    addPluginTemplate.mockClear()
    addDevServerHandler.mockClear()
    hooks = new Map()
})

describe('serializeOptions', () => {
    it('переносит регулярки литералом, а не пустым объектом', () => {
        const { code } = serializeOptions({ exclude: [/^RouterLink/, /^Transition/i] })
        expect(code).toContain('/^RouterLink/')
        expect(code).toContain('/^Transition/i')
    })

    it('не теряет строковые фильтры рядом с регулярками', () => {
        const { code } = serializeOptions({ include: ['ProductCard', /^Cart/] })
        expect(code).toContain('"ProductCard"')
        expect(code).toContain('/^Cart/')
    })

    it('переносит скаляры', () => {
        const { code } = serializeOptions({ panel: false, maxEvents: 50, locale: 'ru' })
        expect(code).toContain('"panel": false')
        expect(code).toContain('"maxEvents": 50')
        expect(code).toContain('"locale": "ru"')
    })

    it('выбрасывает функции и сообщает, какие именно', () => {
        const { code, dropped } = serializeOptions({
            maxEvents: 10,
            include: [(name: string) => name.startsWith('Cart')],
        } as never)
        expect(dropped).toEqual(['include[0]'])
        expect(code).toContain('"maxEvents": 10')
        expect(code).toContain('"include": []')
    })

    it('пустые опции дают пустой литерал', () => {
        expect(serializeOptions({}).code).toBe('{}')
    })

    it('результат — валидный JS, который вычисляется обратно в опции', () => {
        const { code } = serializeOptions({ maxEvents: 7, exclude: [/^Router/] })
        const value = new Function(`return ${code}`)() as { maxEvents: number, exclude: RegExp[] }
        expect(value.maxEvents).toBe(7)
        expect(value.exclude[0]).toBeInstanceOf(RegExp)
        expect(value.exclude[0].test('RouterLink')).toBe(true)
    })
})

describe('buildPluginSource', () => {
    it('собирает клиентский плагин, который зовёт scan с опциями', () => {
        const source = buildPluginSource('{ "panel": false }')
        expect(source).toContain("import { defineNuxtPlugin } from '#app'")
        expect(source).toContain("import { scan } from 'vue-why-render'")
        expect(source).toContain('scan(nuxtApp.vueApp, { "panel": false })')
    })
})

describe('модуль', () => {
    it('объявляет ключ конфига whyRender', () => {
        expect(moduleDefinition.meta.configKey).toBe('whyRender')
        expect(moduleDefinition.meta.name).toBe('vue-why-render')
    })

    it('в деве добавляет клиентский плагин', () => {
        runSetup({})
        expect(addPluginTemplate).toHaveBeenCalledTimes(1)
        const template = addPluginTemplate.mock.calls[0][0] as { mode: string, filename: string }
        expect(template.mode).toBe('client')
        expect(template.filename).toBe('vue-why-render.client.mjs')
    })

    it('в прод-сборке не добавляет ничего', () => {
        runSetup({}, false)
        expect(addPluginTemplate).not.toHaveBeenCalled()
    })

    it('enabled: false выключает модуль и в деве', () => {
        runSetup({ enabled: false })
        expect(addPluginTemplate).not.toHaveBeenCalled()
    })

    it('доносит опции из nuxt.config до плагина', () => {
        runSetup({ includeMounts: true, exclude: [/^Router/] })
        const source = lastPluginSource()
        expect(source).toContain('"includeMounts": true')
        expect(source).toContain('/^Router/')
    })

    it('предупреждает про функции, которые не доехали', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        runSetup({ include: [() => true] })
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('include[0]'))
        warn.mockRestore()
    })
})

describe('вкладка в Nuxt DevTools', () => {
    it('в деве регистрирует страницу и вкладку на неё', () => {
        runSetup({})
        expect(addDevServerHandler).toHaveBeenCalledTimes(1)
        const { route } = addDevServerHandler.mock.calls[0][0] as { route: string }
        expect(route).toBe('/__vue-why-render/devtools')
        expect(collectTabs()).toEqual([
            { name: 'vue-why-render', title: 'Why render', icon: 'carbon:renew', view: { type: 'iframe', src: '/__vue-why-render/devtools' } },
        ])
    })

    it('хук, вызванный дважды (refresh в DevTools), не задваивает вкладку', () => {
        runSetup({})
        const tabs: Array<{ name: string }> = []
        const [fn] = hooks.get('devtools:customTabs')!
        ;(fn as (t: typeof tabs) => void)(tabs)
        ;(fn as (t: typeof tabs) => void)(tabs)
        expect(tabs).toHaveLength(1)
    })

    it('devtoolsTab: false — ни страницы, ни вкладки, а плагин на месте', () => {
        runSetup({ devtoolsTab: false })
        expect(addDevServerHandler).not.toHaveBeenCalled()
        expect(collectTabs()).toEqual([])
        expect(addPluginTemplate).toHaveBeenCalledTimes(1)
    })

    it('в прод-сборке вкладки нет', () => {
        runSetup({}, false)
        expect(addDevServerHandler).not.toHaveBeenCalled()
        expect(hooks.size).toBe(0)
    })

    it('devtoolsTab не уезжает в опции scan() — сканер о ней не знает', () => {
        runSetup({ devtoolsTab: true, includeMounts: true })
        expect(lastPluginSource()).not.toContain('devtoolsTab')
        expect(lastPluginSource()).toContain('"includeMounts": true')
    })

    it('обработчик отдаёт HTML и ставит тип для h3 1.x и 2.x', () => {
        runSetup({})
        const { handler } = addDevServerHandler.mock.calls[0][0] as { handler: ((event: unknown) => string) & { __is_handler__?: boolean } }
        expect(handler.__is_handler__).toBe(true)

        const setHeader = vi.fn()
        const html = handler({ node: { res: { setHeader } } })
        expect(setHeader).toHaveBeenCalledWith('content-type', 'text/html; charset=utf-8')
        expect(html).toContain('<!doctype html>')
        expect(html).toContain('__VUE_WHY_RENDER__')

        const set = vi.fn()
        handler({ res: { headers: { set } } })
        expect(set).toHaveBeenCalledWith('content-type', 'text/html; charset=utf-8')
    })
})
