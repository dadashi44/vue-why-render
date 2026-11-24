import { describe, expect, it } from 'vitest'
import { site, siteLocales } from '../../site/i18n'

function shape(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(shape)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort().map(([k, v]) => [k, shape(v)]))
    return typeof value
}
function strings(value: unknown): string[] {
    if (typeof value === 'string') return [value]
    if (value && typeof value === 'object') return Object.values(value).flatMap(strings)
    return []
}

describe('site i18n', () => {
    it('all locales have the same keys and array lengths', () => {
        for (const locale of siteLocales) expect(shape(site[locale])).toEqual(shape(site.en))
    })
    it('no empty strings', () => {
        for (const locale of siteLocales) expect(strings(site[locale]).filter(s => !s.trim())).toEqual([])
    })
    it('path has four steps and chain has four labels', () => {
        for (const locale of siteLocales) {
            expect(site[locale].path).toHaveLength(4)
            expect(site[locale].chainLabels).toHaveLength(4)
        }
    })
})
