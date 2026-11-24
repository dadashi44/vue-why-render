import { defineMdastPlugin } from 'satteri'

// Ссылки в markdown пишутся абсолютными от корня сайта: /docs/<раздел>/…
// Если сайт лежит не в корне (github.io/vue-why-render/), такие ссылки ведут
// мимо документации. Плагин переписывает их на настоящий base, поэтому
// валидатор ссылок (он идёт после наших плагинов) видит и проверяет уже
// итоговые адреса.
export function docsBasePlugin(base) {
    const prefix = base.replace(/\/+$/, '')

    const rewrite = (url) =>
        url === '/docs' || /^\/docs[/#?]/.test(url) ? prefix + url.slice('/docs'.length) : url

    const visit = (node, ctx) => {
        const url = rewrite(node.url)
        if (url !== node.url) ctx.setProperty(node, 'url', url)
    }

    return defineMdastPlugin({
        name: 'docs-base',
        link: visit,
        definition: visit,
    })
}
