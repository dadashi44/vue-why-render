import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { Renderer } from '@takumi-rs/core'

/**
 * OG-картинка сайта: site/public/og.png, 1200×630 — размер, который Telegram,
 * Discord и X показывают крупным превью без обрезки.
 *
 * Вместо «название + слоган + плашки» на карточке сам продукт в момент работы:
 * страница с карточками товаров, оверлей обвёл перерисованные компоненты
 * цветом по частоте, а рядом — причина рендера, как в панели. Человек видит
 * в превью ровно то, что получит, а не описание словами.
 *
 * Запуск: npm run build:og. PNG лежит в репозитории — сайт собирается без
 * нативного рендерера, а картинка меняется редко.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const font = file => readFileSync(resolve(root, 'scripts/og/fonts', file))

const WIDTH = 1200
const HEIGHT = 630

// Палитра сайта (site/styles.css) и уголки из фавиконки.
const BG = '#0d0f13'
const BG_SOFT = '#14171d'
const LINE = '#242933'
const FG = '#e6e8ec'
const FG_DIM = '#949aa6'
const ACCENT = '#6ee7a8'
const WARN = '#f0a868'
const VUE = '#42b883'

const DISPLAY = 'Bricolage Grotesque'
const MONO = 'JetBrains Mono'

/** Та же формула, что у оверлея (src/overlay/canvas.ts): зелёный → красный. */
function heatColor(heat) {
    const red = Math.round(60 + heat * 195)
    const green = Math.round(200 - heat * 180)
    return `rgb(${red}, ${green}, 90)`
}

const box = (style, children = []) => ({ type: 'container', style: { display: 'flex', ...style }, children })
const txt = (text, style) => ({ type: 'text', text, style })

/** Уголок рамки, как на фавиконке: обводка двух сторон со скруглением. */
function corner(position, size = 56) {
    const [vertical, horizontal] = position
    const border = `5px solid ${WARN}`
    return box({
        position: 'absolute',
        [vertical]: 28,
        [horizontal]: 28,
        width: size,
        height: size,
        [`border${vertical === 'top' ? 'Top' : 'Bottom'}`]: border,
        [`border${horizontal === 'left' ? 'Left' : 'Right'}`]: border,
        [`border${vertical === 'top' ? 'Top' : 'Bottom'}${horizontal === 'left' ? 'Left' : 'Right'}Radius`]: 16,
    })
}

/** Карточка товара из демо. heat === null — компонент не перерисовывался. */
function productCard({ title, heat, count }) {
    const color = heat === null ? null : heatColor(heat)

    const card = box({
        position: 'relative',
        flexDirection: 'column',
        gap: 10,
        width: 150,
        padding: 12,
        backgroundColor: BG_SOFT,
        border: `1px solid ${LINE}`,
        borderRadius: 10,
    }, [
        box({ height: 84, borderRadius: 6, backgroundImage: 'linear-gradient(135deg, #1f2530, #171b22)' }),
        txt(title, { fontFamily: MONO, fontSize: 15, color: FG }),
        box({ width: 70, height: 8, borderRadius: 4, backgroundColor: LINE }),
        box({ gap: 6, alignItems: 'center' }, [
            box({ padding: '3px 8px', borderRadius: 99, backgroundColor: '#2f6f4e' }, [
                txt('new', { fontFamily: MONO, fontSize: 11, color: ACCENT }),
            ]),
            box({ width: 34, height: 8, borderRadius: 4, backgroundColor: LINE }),
        ]),
    ])

    // Прозрачная рамка той же толщины — иначе карточка без обводки съезжает.
    if (!color) return box({ padding: 6, border: '3px solid transparent' }, [card])

    // Рамка и ярлык — как рисует оверлей поверх живой страницы.
    return box({
        position: 'relative',
        padding: 6,
        border: `3px solid ${color}`,
        borderRadius: 14,
        // Частый рендер «горит»: свечение тянет взгляд к проблемной карточке.
        boxShadow: heat > 0.5 ? `0 0 34px ${color.replace('rgb', 'rgba').replace(')', ', 0.45)')}` : 'none',
    }, [
        card,
        box({
            position: 'absolute',
            top: -16,
            left: 10,
            padding: '2px 8px',
            borderRadius: 6,
            backgroundColor: color,
        }, [txt(`ProductCard ×${count}`, { fontFamily: MONO, fontWeight: 700, fontSize: 13, color: '#0d0f13' })]),
    ])
}

/** Окошко страницы с демо-витриной под оверлеем. */
const page = box({
    flexDirection: 'column',
    width: 560,
    backgroundColor: '#101318',
    border: `1px solid ${LINE}`,
    borderRadius: 16,
    boxShadow: '0 30px 80px rgba(0, 0, 0, 0.55)',
}, [
    box({ alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${LINE}` }, [
        ...['#3a3f4a', '#3a3f4a', '#3a3f4a'].map(color =>
            box({ width: 11, height: 11, borderRadius: 99, backgroundColor: color })),
        txt('localhost:5173', { marginLeft: 10, fontFamily: MONO, fontSize: 13, color: FG_DIM }),
    ]),
    box({ gap: 10, padding: '30px 20px 26px' }, [
        productCard({ title: 'Keyboard', heat: 0.08, count: 1 }),
        productCard({ title: 'Mouse', heat: null }),
        productCard({ title: 'Monitor', heat: 1, count: 7 }),
    ]),
])

/** Причина рендера — как строка в панели пакета. */
const reason = box({
    flexDirection: 'column',
    gap: 8,
    padding: '18px 22px',
    width: 470,
    backgroundColor: '#161a21',
    border: '1px solid #343b48',
    borderLeft: `4px solid ${heatColor(1)}`,
    borderRadius: 12,
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
}, [
    box({ gap: 10, alignItems: 'center' }, [
        txt('ProductCard ×7', { fontFamily: MONO, fontWeight: 700, fontSize: 19, color: FG }),
        txt('· 2.4ms · prop badge', { fontFamily: MONO, fontSize: 17, color: FG_DIM }),
    ]),
    txt('└─ { text } → { text }', { fontFamily: MONO, fontSize: 19, color: WARN }),
    txt('   new reference, same value', { fontFamily: MONO, fontWeight: 700, fontSize: 17, color: ACCENT, whiteSpace: 'pre' }),
])

const tree = box({
    width: WIDTH,
    height: HEIGHT,
    position: 'relative',
    backgroundColor: BG,
    // Сетка точек — намёк на холст оверлея, без неё фон читается плоской заливкой.
    backgroundImage: 'radial-gradient(circle at 78% 40%, rgba(66, 184, 131, 0.16), transparent 55%), radial-gradient(#1c2028 1.5px, transparent 1.5px)',
    backgroundSize: '100% 100%, 26px 26px',
}, [
    corner(['top', 'left']),
    corner(['top', 'right']),
    corner(['bottom', 'left']),
    corner(['bottom', 'right']),

    // Левая колонка: вопрос, на который отвечает пакет.
    box({ position: 'absolute', left: 84, top: 100, width: 500, flexDirection: 'column', gap: 26 }, [
        box({ alignItems: 'center', gap: 12 }, [
            box({ width: 12, height: 12, borderRadius: 3, backgroundColor: VUE }),
            txt('vue-why-render', { fontFamily: MONO, fontWeight: 700, fontSize: 24, color: VUE }),
        ]),
        box({ flexDirection: 'column' }, [
            txt('Why did it', { fontFamily: DISPLAY, fontSize: 88, lineHeight: 1, color: FG, letterSpacing: -2, whiteSpace: 'nowrap' }),
            txt('re-render?', { fontFamily: DISPLAY, fontSize: 88, lineHeight: 1, color: ACCENT, letterSpacing: -2, whiteSpace: 'nowrap' }),
        ]),
        txt('Names the exact prop, ref or Pinia field that triggered every Vue render.', {
            fontSize: 25,
            lineHeight: 1.4,
            color: FG_DIM,
        }),
    ]),

    box({ position: 'absolute', left: 84, bottom: 70, alignItems: 'center', gap: 14 }, [
        txt('$ npm i -D vue-why-render', { fontFamily: MONO, fontSize: 20, color: FG }),
    ]),

    // Правая часть чуть повёрнута: снимок «пойманного» момента, а не схема.
    box({ position: 'absolute', left: 600, top: 70, transform: 'rotate(-3deg)' }, [page]),
    box({ position: 'absolute', left: 640, top: 388, transform: 'rotate(-3deg)' }, [reason]),
])

const renderer = new Renderer()
await renderer.registerFont({ name: DISPLAY, data: font('bricolage-grotesque-800.ttf'), weight: 800 })
await renderer.registerFont({ name: MONO, data: font('jetbrains-mono-500.ttf'), weight: 500 })
await renderer.registerFont({ name: MONO, data: font('jetbrains-mono-700.ttf'), weight: 700 })

const out = process.argv[2] ?? resolve(root, 'site/public/og.png')
writeFileSync(out, await renderer.render(tree, { width: WIDTH, height: HEIGHT, format: 'png' }))
console.log(`og image → ${out}`)
