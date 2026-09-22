/**
 * Открытие файла в редакторе через дев-сервер.
 *
 * Сам редактор выбираем не мы: браузер только просит дев-сервер открыть путь,
 * а запускает IDE пакет launch-editor на стороне Vite или Nuxt. Наша задача —
 * попасть в правильный эндпоинт и внятно сказать, если не получилось.
 */

/** Эндпоинты известных дев-серверов. Порядок — от более общего к частному. */
export const KNOWN_ENDPOINTS = [
    // Vite отдаёт его из коробки, им же пользуется оверлей ошибок.
    '/__open-in-editor?file={file}',
    // Nuxt DevTools держит свой.
    '/__nuxt_devtools__/open-in-editor?file={file}',
]

export function buildEditorUrl(template: string, file: string): string {
    return template.replace('{file}', encodeURIComponent(file))
}

/** Настроенный шаблон идёт первым, дальше — известные, без повторов. */
export function editorCandidates(configured: string): string[] {
    return [...new Set([configured, ...KNOWN_ENDPOINTS])].filter(Boolean)
}

export const EDITOR_HELP = [
    '[vue-why-render] could not open the file in your editor.',
    '',
    'The request reached the dev server but nothing opened. This is almost always',
    'the editor launcher, not the dev server: it defaults to VS Code and fails with',
    'ENOENT when the `code` command is not in PATH.',
    '',
    'Fix it by naming your editor explicitly — in the project .env or your shell:',
    '',
    '  LAUNCH_EDITOR=webstorm     # also: code, cursor, idea, phpstorm, goland,',
    '                             # rubymine, pycharm, sublime, atom, vim, emacs',
    '',
    'Then restart the dev server. If your dev server exposes the endpoint at a',
    'non-standard path, pass it explicitly: openInEditorUrl: "/my-path?file={file}".',
].join('\n')

/**
 * Пробует кандидатов по очереди и возвращает true, если хоть один ответил успехом.
 *
 * Оговорка, важная для ожиданий: если дев-сервер ответил 200, а launch-editor
 * потом упал с ENOENT, мы об этом не узнаем — ошибка остаётся в терминале.
 * Поэтому подсказка ниже описывает и этот случай тоже.
 */
export async function requestOpenInEditor(
    file: string,
    configured: string,
    fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
    for (const template of editorCandidates(configured)) {
        try {
            const response = await fetchImpl(buildEditorUrl(template, file))
            if (response.ok) return true
        }
        catch {
            // Следующий кандидат.
        }
    }
    return false
}
