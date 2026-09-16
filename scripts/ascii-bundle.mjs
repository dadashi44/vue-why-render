import { build } from 'esbuild'

/**
 * Постобработка публикуемого бандла: вырезаем комментарии и уводим
 * не-ASCII символы в \uXXXX.
 *
 * Зачем: плагины, переписывающие код у потребителя (@rollup/plugin-commonjs
 * в составе Vite), считают смещения в байтах. Кириллица в комментариях и
 * строках интерфейса сдвигает их, вставки уезжают, и прод-сборка приложения
 * падает с синтаксической ошибкой внутри нашего файла. Проверено на живом
 * Nuxt-проекте: до постобработки сборка падала, после — проходит.
 *
 * Идентификаторы намеренно не мангрим, файл остаётся читаемым.
 */
const targets = [
    { file: 'dist/index.js', format: 'esm' },
    { file: 'dist/index.cjs', format: 'cjs' },
]

for (const { file, format } of targets) {
    await build({
        entryPoints: [file],
        outfile: file,
        allowOverwrite: true,
        bundle: false,
        format,
        target: 'es2022',
        charset: 'ascii',
        minifyWhitespace: true,
        minifySyntax: true,
        minifyIdentifiers: false,
        legalComments: 'none',
        logLevel: 'error',
    })
}

console.log('bundle: comments stripped, ascii only')
