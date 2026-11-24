import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sections } from '../src/pages-list.mjs'

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../../dist-site')

// Тексты уведомления Starlight о непереведённой странице (i18n.untranslatedContent).
const fallbackNotice = {
    '': 'This content is not available in your language yet.',
    ru: 'Это содержимое пока не доступно на вашем языке.',
    'zh-cn': '此内容尚不支持你的语言。',
}

const slugs = sections.flatMap((s) => s.items.map((i) => i.slug))

test('every page exists in every locale', () => {
    for (const slug of slugs) {
        for (const [locale, notice] of Object.entries(fallbackNotice)) {
            const parts = ['docs', locale, slug === 'index' ? '' : slug, 'index.html'].filter(Boolean)
            const file = resolve(dist, ...parts)
            assert.ok(existsSync(file), `missing ${parts.join('/')}`)
            assert.ok(
                !readFileSync(file, 'utf8').includes(notice),
                `${parts.join('/')} is an untranslated fallback page`,
            )
        }
    }
})

test('search index is built', () => {
    assert.ok(existsSync(resolve(dist, 'docs/pagefind/pagefind.js')))
})

test('landing and case page survive', () => {
    assert.ok(existsSync(resolve(dist, 'index.html')))
    assert.ok(existsSync(resolve(dist, 'cases/bigplay/index.html')))
})

test('respects SITE_BASE', () => {
    const html = readFileSync(resolve(dist, 'docs/index.html'), 'utf8')
    const base = process.env.SITE_BASE === '/vue-why-render/' ? '/vue-why-render' : ''
    assert.ok(html.includes(`href="${base}/docs/`), `expected href="${base}/docs/`)

    // Ссылки в содержимом страниц пишутся как /docs/…, а на выходе должны получить base.
    const page = readFileSync(resolve(dist, 'docs/start/installation/index.html'), 'utf8')
    const content = page.slice(page.indexOf('<main'), page.indexOf('</main>'))
    assert.ok(content.includes(`href="${base}/docs/start/vue/"`), 'cross-link lost its base')
    if (base) {
        assert.ok(!/href="\/docs\//.test(content), 'content link points outside the base')
    }
})
