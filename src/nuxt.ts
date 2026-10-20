import { addDevServerHandler, addPluginTemplate, defineNuxtModule } from '@nuxt/kit'
import type { NuxtModule } from '@nuxt/schema'
import type { VueWhyRenderOptions } from './types'
import { buildDevtoolsTabPage, DEVTOOLS_TAB_ROUTE } from './devtools-tab'

/**
 * Опции модуля — это опции пакета без `onRender`.
 *
 * Колбэк пришлось бы переносить из `nuxt.config` в сгенерированный плагин
 * текстом, а функция из конфига обычно замкнута на окружение сборки и в
 * браузере просто не соберётся. Кому нужен колбэк — подключается вручную
 * через `scan()` в своём клиентском плагине.
 */
export type NuxtWhyRenderOptions = Omit<VueWhyRenderOptions, 'onRender' | 'onBudgetExceeded'> & {
    /**
     * Вкладка «Why render» в Nuxt DevTools. Только модульная опция: в плагин
     * не переносится — вкладку регистрирует сборка, а не приложение.
     */
    devtoolsTab?: boolean
}

/** Вкладка в списке Nuxt DevTools — по контракту хука `devtools:customTabs` (DevTools 3 и 4). */
export interface DevtoolsTab {
    name: string
    title: string
    icon: string
    view: { type: 'iframe', src: string }
}

export const DEVTOOLS_TAB: DevtoolsTab = {
    name: 'vue-why-render',
    title: 'Why render',
    icon: 'carbon:renew',
    view: { type: 'iframe', src: DEVTOOLS_TAB_ROUTE },
}

/**
 * Обработчик страницы вкладки для дев-сервера Nitro.
 *
 * Без импорта h3: под pnpm он может не резолвиться из нашего пакета (так уже
 * было с @nuxt/schema). Помечаем функцию так же, как это делает
 * `defineEventHandler`, — h3 1.x узнаёт обработчик по этому флагу, 2.x
 * принимает функцию как есть. Заголовок ставим сами для обеих версий.
 */
export function createDevtoolsTabHandler(): ((event: unknown) => string) & { __is_handler__: true } {
    const page = buildDevtoolsTabPage()
    const handler = (event: unknown): string => {
        const contentType = 'text/html; charset=utf-8'
        const target = event as { node?: { res?: { setHeader?: (name: string, value: string) => void } }, res?: { headers?: { set?: (name: string, value: string) => void } } }
        target.node?.res?.setHeader?.('content-type', contentType)
        target.res?.headers?.set?.('content-type', contentType)
        return page
    }
    return Object.assign(handler, { __is_handler__: true as const })
}

/**
 * Превращает значение в кусок исходника плагина.
 *
 * Через `runtimeConfig` опции не передать: `include` и `exclude` принимают
 * регулярки, а JSON превращает их в пустой объект — фильтры молча перестают
 * работать. Поэтому опции инлайнятся в генерируемый файл как код, и `/^Router/`
 * остаётся регуляркой.
 *
 * Возвращает `null` для того, что в код перенести нельзя: функций и `undefined`.
 */
function serializeValue(value: unknown, path: string, dropped: string[]): string | null {
    if (value instanceof RegExp) return value.toString()

    if (typeof value === 'function') {
        dropped.push(path)
        return null
    }

    if (Array.isArray(value)) {
        const items = value
            .map((item, index) => serializeValue(item, `${path}[${index}]`, dropped))
            .filter((item): item is string => item !== null)
        return `[${items.join(', ')}]`
    }

    if (value && typeof value === 'object') {
        const entries = Object.entries(value)
            .map(([key, nested]) => {
                const serialized = serializeValue(nested, path ? `${path}.${key}` : key, dropped)
                return serialized === null ? null : `${JSON.stringify(key)}: ${serialized}`
            })
            .filter((entry): entry is string => entry !== null)
        return entries.length ? `{ ${entries.join(', ')} }` : '{}'
    }

    if (value === undefined) return null

    return JSON.stringify(value)
}

export interface SerializedOptions {
    /** Литерал опций, готовый к подстановке в исходник плагина. */
    code: string
    /** Пути до значений, которые перенести не удалось. */
    dropped: string[]
}

export function serializeOptions(options: NuxtWhyRenderOptions): SerializedOptions {
    const dropped: string[] = []
    const code = serializeValue(options, '', dropped) ?? '{}'
    return { code, dropped }
}

/** Исходник клиентского плагина с уже подставленными опциями. */
export function buildPluginSource(code: string): string {
    return [
        "import { defineNuxtPlugin } from '#app'",
        "import { scan } from 'vue-why-render'",
        '',
        'export default defineNuxtPlugin((nuxtApp) => {',
        `    scan(nuxtApp.vueApp, ${code})`,
        '})',
        '',
    ].join('\n')
}

/**
 * Тип прописан руками, а не выведен: под pnpm `@nuxt/schema` лежит у `@nuxt/kit`
 * внутри `.pnpm/...`, и без аннотации vue-tsc не может назвать его в `.d.ts`
 * (TS2742) — сборка падает.
 */
const whyRenderModule: NuxtModule<NuxtWhyRenderOptions, NuxtWhyRenderOptions, false> = defineNuxtModule<NuxtWhyRenderOptions>({
    meta: {
        name: 'vue-why-render',
        configKey: 'whyRender',
        // Не 3.0.0: пакет требует Vue ^3.3.0, а Nuxt тянет Vue прямой
        // зависимостью — до 3.5.0 там приколочен ^3.2.x. 3.5.0 — первый
        // релиз, чей пин удовлетворяет нашему peer.
        compatibility: { nuxt: '>=3.5.0' },
    },
    defaults: {},
    setup(options, nuxt) {
        // Выключено руками — не добавляем даже плагин.
        if (options.enabled === false) return

        // Вся причина существования модуля: в прод-сборке от пакета не остаётся
        // ни вызова, ни импорта, и пользователю не нужно помнить про import.meta.dev.
        if (!nuxt.options.dev) return

        const { devtoolsTab = true, ...scanOptions } = options
        const { code, dropped } = serializeOptions(scanOptions)

        if (dropped.length) {
            console.warn(
                `[vue-why-render] These options cannot be passed through nuxt.config and were ignored: ${dropped.join(', ')}. `
                    + 'Functions do not survive the move into the generated plugin — use scan() in your own client plugin instead.',
            )
        }

        addPluginTemplate({
            filename: 'vue-why-render.client.mjs',
            // Плагин обязан быть клиентским: панель и оверлей трогают document,
            // на сервере это падение рендера.
            mode: 'client',
            getContents: () => buildPluginSource(code),
        })

        if (devtoolsTab) {
            addDevServerHandler({ route: DEVTOOLS_TAB_ROUTE, handler: createDevtoolsTabHandler() as never })
            // Хук, а не addCustomTab из @nuxt/devtools-kit: зависимости не нужно,
            // а без DevTools хук просто никто не вызовет. В DevTools 4 addCustomTab
            // объявлен устаревшим, но сам хук по-прежнему собирает вкладки модулей.
            nuxt.hook('devtools:customTabs' as never, ((tabs: DevtoolsTab[]) => {
                if (!tabs.some(tab => tab.name === DEVTOOLS_TAB.name)) tabs.push({ ...DEVTOOLS_TAB })
            }) as never)
        }
    },
})

export default whyRenderModule
