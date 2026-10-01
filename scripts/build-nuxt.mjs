import { build } from 'esbuild'

/**
 * Сборка входа `vue-why-render/nuxt`.
 *
 * Отдельно от основного бандла по двум причинам: модуль исполняется в Node на
 * стороне сборки Nuxt, а не в браузере, и ему нужен `@nuxt/kit`, которого в
 * зависимостях пакета нет и не будет — он приезжает вместе с самим Nuxt.
 *
 * Постобработка та же, что у основного бандла: комментарии вон, не-ASCII в
 * \uXXXX. Причина описана в scripts/ascii-bundle.mjs.
 */
await build({
    entryPoints: ['src/nuxt.ts'],
    outfile: 'dist/nuxt.mjs',
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    external: ['@nuxt/kit'],
    charset: 'ascii',
    minifyWhitespace: true,
    minifySyntax: true,
    minifyIdentifiers: false,
    legalComments: 'none',
    logLevel: 'error',
})

console.log('nuxt module: dist/nuxt.mjs')
