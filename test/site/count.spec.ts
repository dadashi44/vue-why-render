import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(__dirname, '../../site/public/count.js'), 'utf8')

function run(hostname: string, webdriver = false) {
    const images: { src: string }[] = []
    class FakeImage {
        src = ''
        constructor() {
            images.push(this)
        }
    }
    new Function('location', 'navigator', 'document', 'screen', 'Image', source)(
        { hostname, pathname: '/docs/ru/', search: '?lang=ru' },
        { webdriver },
        { title: 'Docs', referrer: '' },
        { width: 1280 },
        FakeImage,
    )
    return images
}

describe('count.js', () => {
    it('counts a page view on the production host without the query', () => {
        const images = run('vue-why-render.js.org')
        expect(images).toHaveLength(1)
        const src = images[0].src
        expect(src.startsWith('https://dadashi44.goatcounter.com/count?')).toBe(true)
        expect(new URL(src).searchParams.get('p')).toBe('/docs/ru/')
        expect(src).not.toContain('lang=')
    })

    it('ignores localhost', () => {
        expect(run('localhost')).toHaveLength(0)
    })

    it('ignores the github.io mirror', () => {
        expect(run('dadashi44.github.io')).toHaveLength(0)
    })

    it('ignores automated browsers', () => {
        expect(run('vue-why-render.js.org', true)).toHaveLength(0)
    })
})
