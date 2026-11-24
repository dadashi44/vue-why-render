import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SiteTimeline from '../../site/components/SiteTimeline.vue'
import { site } from '../../site/i18n'
import { bigplayRows, isHot, MAX_TICKS, ticks } from '../../site/timeline'

describe('timeline data', () => {
    it('has the BIGPLAY rows', () => {
        expect(bigplayRows.map(r => [r.name, r.before, r.after])).toEqual([
            ['card', 600, 10], ['FinishOfRegistrationTimer', 120, 2], ['ui-logo', 20, 0], ['navbar', 10, 0], ['footer', 10, 0],
        ])
        expect(bigplayRows.map(r => r.scenario)).toEqual(['home', 'home', 'query', 'query', 'query'])
    })

    it('ticks are capped, even and in range', () => {
        expect(MAX_TICKS).toBe(40)
        expect(ticks(600)).toHaveLength(40)
        expect(ticks(2)).toHaveLength(2)
        expect(ticks(0)).toEqual([])
        expect(ticks(40).every(p => p >= 0 && p <= 100)).toBe(true)
    })

    it('hot above 10', () => {
        expect(isHot(11)).toBe(true)
        expect(isHot(10)).toBe(false)
    })
})

describe('SiteTimeline', () => {
    it('toggles between before and after', async () => {
        const wrapper = mount(SiteTimeline, { props: { t: site.en } })
        const buttons = wrapper.findAll('button')
        expect(buttons[0]!.attributes('aria-pressed')).toBe('true')
        expect(buttons[1]!.attributes('aria-pressed')).toBe('false')
        expect(wrapper.find('.timeline__total').text()).toContain('760')
        for (const lane of wrapper.findAll('.timeline__lane')) {
            expect(lane.findAll('.timeline__tick').length).toBeLessThanOrEqual(40)
        }

        await buttons[1]!.trigger('click')
        expect(buttons[0]!.attributes('aria-pressed')).toBe('false')
        expect(buttons[1]!.attributes('aria-pressed')).toBe('true')
        expect(wrapper.find('.timeline__total').text()).toContain('12')
        expect(wrapper.find('.timeline__total').text()).not.toContain('760')

        const rows = wrapper.findAll('.timeline__row')
        expect(rows[0]!.findAll('.timeline__tick--on')).toHaveLength(10)
        expect(rows[2]!.find('.timeline__count').text()).toBe('×0')
        expect(wrapper.text()).toContain(site.en.noteAfter)
        expect(wrapper.find('a').attributes('href')).toBe('cases/bigplay/')
    })
})
