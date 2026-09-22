import { describe, expect, it, vi } from 'vitest'
import {
    EDITOR_HELP,
    KNOWN_ENDPOINTS,
    buildEditorUrl,
    editorCandidates,
    requestOpenInEditor,
} from '../src/panel/open-in-editor'

const ok = () => ({ ok: true }) as Response
const notFound = () => ({ ok: false }) as Response

describe('buildEditorUrl', () => {
    it('подставляет файл в шаблон и экранирует путь', () => {
        expect(buildEditorUrl('/__open-in-editor?file={file}', '/app/src/A B.vue'))
            .toBe('/__open-in-editor?file=%2Fapp%2Fsrc%2FA%20B.vue')
    })
})

describe('editorCandidates', () => {
    it('ставит настроенный шаблон первым', () => {
        expect(editorCandidates('/custom?file={file}')[0]).toBe('/custom?file={file}')
    })

    it('не дублирует шаблон, совпавший с известным', () => {
        const candidates = editorCandidates(KNOWN_ENDPOINTS[0])
        expect(candidates).toEqual(KNOWN_ENDPOINTS)
    })

    it('всегда предлагает известные эндпоинты как запасные', () => {
        const candidates = editorCandidates('/custom?file={file}')
        for (const known of KNOWN_ENDPOINTS) expect(candidates).toContain(known)
    })
})

describe('requestOpenInEditor', () => {
    it('останавливается на первом успешном ответе', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(ok())
        expect(await requestOpenInEditor('/app/A.vue', '/custom?file={file}', fetchImpl)).toBe(true)
        expect(fetchImpl).toHaveBeenCalledTimes(1)
    })

    it('перебирает запасные, если настроенный эндпоинт не отвечает', async () => {
        // Ровно случай Nuxt: дефолтный путь от Vite там отдаёт 404,
        // а рабочий лежит под /__nuxt_devtools__.
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(notFound())
            .mockResolvedValueOnce(ok())

        expect(await requestOpenInEditor('/app/A.vue', KNOWN_ENDPOINTS[0], fetchImpl)).toBe(true)
        expect(fetchImpl).toHaveBeenCalledTimes(2)
        expect(fetchImpl.mock.calls[1][0]).toContain('__nuxt_devtools__')
    })

    it('переживает сетевую ошибку и пробует дальше', async () => {
        const fetchImpl = vi.fn()
            .mockRejectedValueOnce(new Error('network'))
            .mockResolvedValueOnce(ok())

        expect(await requestOpenInEditor('/app/A.vue', '/custom?file={file}', fetchImpl)).toBe(true)
    })

    it('возвращает false, когда не ответил никто', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(notFound())
        expect(await requestOpenInEditor('/app/A.vue', '/custom?file={file}', fetchImpl)).toBe(false)
    })
})

describe('подсказка', () => {
    it('называет переменную и перечисляет редакторы', () => {
        expect(EDITOR_HELP).toContain('LAUNCH_EDITOR')
        expect(EDITOR_HELP).toContain('webstorm')
        expect(EDITOR_HELP).toContain('openInEditorUrl')
    })
})
