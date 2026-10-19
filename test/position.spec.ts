import { afterEach, describe, expect, it, vi } from 'vitest'
import { clampPosition, loadPosition, savePosition } from '../src/panel/position'

const viewport = { width: 1000, height: 800 }
const panel = { width: 420, height: 300 }

describe('clampPosition', () => {
    it('не трогает позицию внутри окна', () => {
        expect(clampPosition({ right: 100, bottom: 50 }, panel, viewport)).toEqual({ right: 100, bottom: 50 })
    })

    it('не выпускает панель за края', () => {
        expect(clampPosition({ right: -20, bottom: -5 }, panel, viewport)).toEqual({ right: 0, bottom: 0 })
        expect(clampPosition({ right: 9000, bottom: 9000 }, panel, viewport)).toEqual({ right: 580, bottom: 500 })
    })

    it('панель больше окна прижимает к краю, а не уводит в минус', () => {
        expect(clampPosition({ right: 50, bottom: 50 }, { width: 2000, height: 2000 }, viewport))
            .toEqual({ right: 0, bottom: 0 })
    })
})

describe('loadPosition / savePosition', () => {
    afterEach(() => {
        localStorage.clear()
        vi.restoreAllMocks()
    })

    it('сохраняет и читает позицию, округляя до пикселя', () => {
        savePosition({ right: 10.6, bottom: 20.2 })
        expect(loadPosition()).toEqual({ right: 11, bottom: 20 })
    })

    it('мусор в хранилище даёт null, а не падение', () => {
        localStorage.setItem('vue-why-render:panel-position', '{not json')
        expect(loadPosition()).toBeNull()
        localStorage.setItem('vue-why-render:panel-position', '{"right":"a","bottom":1}')
        expect(loadPosition()).toBeNull()
    })

    it('переживает недоступный localStorage', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('SecurityError')
        })
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError')
        })
        expect(loadPosition()).toBeNull()
        expect(() => savePosition({ right: 1, bottom: 1 })).not.toThrow()
    })
})
