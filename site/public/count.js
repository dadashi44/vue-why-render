// Счётчик просмотров GoatCounter: без cookies и без чужого скрипта.
// Считаем только боевой адрес; query (?lang=) не отправляем.
if (location.hostname === 'vue-why-render.js.org' && !navigator.webdriver) {
    new Image().src =
        'https://dadashi44.goatcounter.com/count?' +
        new URLSearchParams({
            p: location.pathname,
            t: document.title,
            r: document.referrer,
            s: String(screen.width),
            rnd: String(Math.random()).slice(2),
        })
}
