import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const stub = fileURLToPath(new URL('./src/vue-stub.ts', import.meta.url))

await build({
    entryPoints: ['src/cli.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    packages: 'external',
    outfile: 'dist/cli.js',
    banner: { js: '#!/usr/bin/env node' },
    alias: { vue: stub },
})
