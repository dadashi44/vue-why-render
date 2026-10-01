import { build } from 'esbuild'
import { readFile, writeFile } from 'node:fs/promises'

/**
 * Сборка входа `vue-why-render/test`.
 *
 * Отдельным файлом, а не вторым входом основного бандла: мультивход заставил бы
 * rollup вынести общий код в отдельные чанки, а публикуемый бандл специально
 * собран одним файлом — из-за плагинов, переписывающих код у потребителя.
 *
 * Поэтому ядро остаётся внешним: `./index.js` для ESM и `./index.cjs` для CJS,
 * оба лежат рядом в dist.
 */
const targets = [
    { outfile: 'dist/test.js', format: 'esm', core: './index.js' },
    { outfile: 'dist/test.cjs', format: 'cjs', core: './index.cjs' },
]

for (const { outfile, format, core } of targets) {
    await build({
        entryPoints: ['src/test.ts'],
        outfile,
        bundle: true,
        format,
        target: 'es2022',
        platform: 'neutral',
        external: ['vue', './index.js'],
        charset: 'ascii',
        minifyWhitespace: true,
        minifySyntax: true,
        minifyIdentifiers: false,
        legalComments: 'none',
        logLevel: 'error',
    })

    if (core !== './index.js') {
        const source = await readFile(outfile, 'utf8')
        await writeFile(outfile, source.replaceAll('./index.js', core), 'utf8')
    }
}

console.log('test helpers: dist/test.js, dist/test.cjs')
