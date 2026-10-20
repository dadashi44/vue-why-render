/**
 * Страница вкладки в Nuxt DevTools.
 *
 * Своего бандла у неё нет и быть не должно: панель рисует Vue самого
 * приложения через `window.__VUE_WHY_RENDER__.mountPanel()`, а данные — тот же
 * живой реестр. Вкладка — iframe внутри DevTools, DevTools — iframe внутри
 * страницы приложения с того же origin, поэтому приложение видно через `top`.
 * Если DevTools открыт отдельным окном, приложение — его `opener`.
 */

export const DEVTOOLS_TAB_ROUTE = '/__vue-why-render/devtools'

/**
 * Скрипт страницы — обычный ES5 без зависимостей, строкой: он исполняется в
 * документе вкладки, где нет ни Vue, ни сборщика.
 *
 * Приложение может загрузиться позже вкладки, а после полной перезагрузки
 * страницы — смениться на новое, поэтому handle ищется заново раз в секунду,
 * и панель перемонтируется, если он поменялся.
 */
export const DEVTOOLS_TAB_SCRIPT = `(function () {
    var root = document.getElementById('root')
    var note = document.getElementById('note')
    var mounted = null
    var unmount = null
    var misses = 0

    function windows() {
        var out = []
        function add(win) {
            try {
                if (win && win !== window && out.indexOf(win) === -1) out.push(win)
            } catch (error) {}
        }
        try { add(window.top) } catch (error) {}
        try {
            for (var win = window.parent; win && win !== window; win = win.parent) {
                add(win)
                if (win === win.parent) break
            }
        } catch (error) {}
        try { add(window.opener) } catch (error) {}
        try { add(window.top.opener) } catch (error) {}
        return out
    }

    function find() {
        var list = windows()
        for (var i = 0; i < list.length; i++) {
            try {
                var handle = list[i].__VUE_WHY_RENDER__
                if (handle && typeof handle.mountPanel === 'function') return handle
            } catch (error) {}
        }
        return null
    }

    function check() {
        var handle = find()
        if (handle && handle !== mounted) {
            if (unmount) unmount()
            root.textContent = ''
            unmount = handle.mountPanel(root)
            mounted = handle
            note.hidden = true
            misses = 0
        }
        else if (!handle) {
            misses++
            // Пару секунд даём приложению догрузиться, прежде чем пугать.
            if (misses > 3) note.hidden = false
        }
    }

    check()
    setInterval(check, 1000)
    window.addEventListener('pagehide', function () {
        if (unmount) unmount()
    })
})()`

/** HTML вкладки. Тема — системная, как у самой панели в режиме auto. */
export function buildDevtoolsTabPage(): string {
    return [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<title>vue-why-render</title>',
        '<style>',
        ':root { color-scheme: light dark; }',
        'html, body { margin: 0; height: 100%; }',
        'body { background: Canvas; color: CanvasText; font: 13px/1.5 ui-sans-serif, system-ui, sans-serif; }',
        '#root { height: 100%; }',
        '#note { padding: 24px; max-width: 560px; }',
        '#note code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }',
        '</style>',
        '</head>',
        '<body>',
        '<div id="root"></div>',
        '<div id="note" hidden>',
        '<p><b>vue-why-render is not running on this page.</b></p>',
        '<p>The tab shows the panel of the app that opened Nuxt DevTools. Open DevTools from the app page itself, ',
        'and check that the scanner is not switched off with <code>whyRender: { enabled: false }</code>.</p>',
        '</div>',
        `<script>${DEVTOOLS_TAB_SCRIPT}</script>`,
        '</body>',
        '</html>',
        '',
    ].join('\n')
}
