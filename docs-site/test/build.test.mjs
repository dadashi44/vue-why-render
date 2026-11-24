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
    const expected =
        process.env.SITE_BASE === '/vue-why-render/' ? 'href="/vue-why-render/docs/' : 'href="/docs/'
    assert.ok(html.includes(expected), `expected ${expected}`)
})
