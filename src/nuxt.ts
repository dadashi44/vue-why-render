import { addPluginTemplate, defineNuxtModule } from '@nuxt/kit'
import type { VueWhyRenderOptions } from './types'

/**
 * Опции модуля — это опции пакета без `onRender`.
 *
 * Колбэк пришлось бы переносить из `nuxt.config` в сгенерированный плагин
 * текстом, а функция из конфига обычно замкнута на окружение сборки и в
 * браузере просто не соберётся. Кому нужен колбэк — подключается вручную
 * через `scan()` в своём клиентском плагине.
 */
export type NuxtWhyRenderOptions = Omit<VueWhyRenderOptions, 'onRender'>

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

export default defineNuxtModule<NuxtWhyRenderOptions>({
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

        const { code, dropped } = serializeOptions(options)

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
    },
})
