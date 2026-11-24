# Landing Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Новая главная vue-why-render.js.org (шапка, герой со вспышками, цепочка причины, песочница, пять причин, таймлайн до/после, путь, MCP) на трёх языках и счётчик GoatCounter на главной, кейсе и в документации.

**Architecture:** Переделка `site/` на месте: страница собирается из компонентов `site/components/Site*.vue`, тексты в `site/i18n.ts`, стили в `site/styles.css`, анимации на CSS keyframes. Существующая песочница (`id="demo"`) переносится без изменений логики. Счётчик — свой скрипт `site/public/count.js`.

**Tech Stack:** Vue 3, Vite, Pinia (уже есть), vitest + @vue/test-utils + jsdom (уже есть), `@fontsource/onest` 5.x и `@fontsource/jetbrains-mono` 5.x (новые devDependencies), Astro Starlight (только `head`).

**Spec:** `docs/superpowers/specs/2026-11-24-landing-redesign-design.md`. Макеты: `docs/superpowers/specs/landing-mockups/a-hero.html`, `b-chain.html`, `c-timeline.html` — брать раскладку, размеры, тексты и keyframes, не синтаксис `.dc.html`.

## Global Constraints

- Цвета только существующие из `site/styles.css`: `--bg #0d0f13`, `--bg-soft #14171d`, `--line #242933`, `--fg #e6e8ec`, `--fg-dim #949aa6`, `--accent #6ee7a8`, `--warn #f0a868` (оранжевый «горячих»). Новые переменные допустимы только как оттенки этих (rgba).
- Шрифты: Onest (текст) и JetBrains Mono (код) через `@fontsource/*`, импорт в `site/main.ts`; подмножества latin + cyrillic. Документацию не трогать.
- Все новые компоненты называются `Site…` (их исключает панель: `exclude: [/^Site/, 'App', 'Anonymous']` в `site/main.ts`).
- Три языка `en`, `ru`, `zh-CN`; каждый новый текст — в `site/i18n.ts` для всех трёх. Имена компонентов, строки кода и причин не переводятся.
- Ссылки: Docs `t.docsHref`; MCP `t.docsHref + 'guides/mcp/'`; Changelog `https://github.com/dadashi44/vue-why-render/blob/main/CHANGELOG.md`; Case `cases/bigplay/`; GitHub `https://github.com/dadashi44/vue-why-render`. Песочница — `#demo`.
- Анимации: только три (вспышки в герое, сигнал по цепочке, полоса таймлайна) + плавная смена отметок таймлайна по клику. Никаких появлений секций при прокрутке и hover-анимаций блоков. `@media (prefers-reduced-motion: reduce)` выключает все циклы и показывает конечное состояние.
- Ширина контента 1200 px, поля 24 px; при 390 px — без горизонтальной прокрутки страницы (широкий код — `overflow-x: auto` внутри блока).
- Без новых `dependencies` в корневом `package.json`.
- Коммиты от пользователя: без `Co-Authored-By`, без упоминаний Claude/ассистента.
- Проверки ветки: `npm run lint`, `npx vue-tsc -p tsconfig.build.json --noEmit`, `npx vitest run`, `npm run build:site`; для Task 5 ещё `docs:build`/`docs:test` с Node 22.23.4 (`PATH=$HOME/.nvm/versions/node/v22.23.4/bin:$PATH`).

## Review Focus

- Песочница после переделки: панель видит ProductCard, корзину, часы и не показывает ни одного `Site*` — тест в Task 2 монтирует `App` с плагином и проверяет имена в `getStats()`.
- Ключи словаря: язык без какого-то текста покажет `undefined` — тест в Task 1 сравнивает форму всех трёх словарей и ищет пустые строки.
- Таймлайн с большим числом рендеров (×600): дорожка не должна получить 600 DOM-узлов — тест в Task 4 (не больше 40 отметок).
- Счётчик вне домена: localhost, github.io и `?lang=` — тесты в Task 5 (не отправляет; путь без query).
- `prefers-reduced-motion` — проверка в Task 2 (CSS содержит медиазапрос, отключающий все три keyframes-класса) и ручная проверка в финале.

---

### Task 1: Словарь новой главной

**Files:**
- Modify: `site/i18n.ts`
- Test: `test/site/i18n.spec.ts`

**Interfaces:**
- Produces: `SiteMessages` с ключами ниже (старые ключи `installHeading`, `installNote`, `usageHeading`, `usageNote`, `nuxtLabel`, `nuxtNote`, `viteLabel`, `featuresHeading`, `features`, `reportsHeading`, `reportsLead`, `reportsNote`, `tag`, `sampleReason`, `sampleNote` удаляются, когда Task 3 перестанет их использовать — в этой задаче остаются, чтобы страница собиралась). Новые ключи:
  - `nav: { docs: string, playground: string, caseStudy: string, changelog: string }`, `languageLabel: string`
  - `heroNews: string` (строка над заголовком про MCP в 0.9.0), `title: [string, string]` (смысл прежний), `lead: string`, `readDocs: string`, `tryHere: string`, `copyInstall: string` (aria-label), `copied: string`, `heroCaption: string` («настоящая панель работает на этой странице, Alt+R»)
  - `chainHeading: string`, `chainLead: string`, `chainLabels: [string, string, string, string]` (your code / store / computed / rendered)
  - `causesHeading: string`, `causesLead: string`
  - `timelineHeading: string`, `timelineLead: string`, `before: string`, `after: string`, `rendersLabel: string`, `scenarioHome: string` («60 секунд на главной»), `scenarioQuery: string` («10 смен query»), `noteBefore: string`, `noteAfter: string`, `readCase: string`
  - `pathHeading: string`, `path: { title: string, text: string }[]` (ровно 4: заметил, отчёт, тест, бюджет)
  - `agentsHeading: string`, `agentsLead: string`, `agentsLink: string`
  - существующие `name`, `docs`, `docsHref`, `caseLink`, `sources`, `footer`, демо-ключи — без изменений.
- Тексты `noteBefore`/`noteAfter` — по спеке: до — «−98% renders, −98% time» + `route query.utm_campaign`; после — «navbar, ui-logo, footer: ×40 → ×0».

- [ ] **Step 1: Write the failing test** `test/site/i18n.spec.ts`

```ts
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
```

- [ ] **Step 2: Run** `npx vitest run test/site/i18n.spec.ts` — Expected: FAIL (нет `path`/`chainLabels`).
- [ ] **Step 3: Add the keys** to `SiteMessages` and all three locales in `site/i18n.ts`. Тексты по макетам (`a-hero.html`, `b-chain.html`, `c-timeline.html`) и спеке; ru и zh — переводы, не калька.
- [ ] **Step 4: Run** the test, `npx vue-tsc -p tsconfig.build.json --noEmit` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(site): new landing copy in three languages`

### Task 2: Каркас, шапка и герой

**Files:**
- Create: `site/components/SiteHeader.vue`, `site/components/SiteHero.vue`
- Modify: `site/App.vue`, `site/styles.css`, `site/main.ts`, `package.json` (devDependencies `@fontsource/onest`, `@fontsource/jetbrains-mono`), `package-lock.json`
- Test: `test/site/landing.spec.ts`

**Interfaces:**
- Consumes: `site`, `detectLocale`, `siteLocales` из `site/i18n.ts` (Task 1).
- Produces: `SiteHeader` props `{ t: SiteMessages, locale: Locale }`, событие `switch-locale(next: Locale)`; `SiteHero` props `{ t: SiteMessages }`. `App.vue` держит `switchTo` (как сейчас) и порядок блоков из спеки; места для блоков Task 3/4 — пока старые секции между песочницей и футером остаются.
- Шапка: липкая, `rgba(13,15,19,.88)` + `backdrop-filter: blur(10px)`, логотип (`site/public/favicon.svg` или inline-SVG как в макете A) + «vue-why-render», навигация (Docs, Playground → `#demo`, Case study, Changelog), `<select>` языка с `<label>` (visually hidden) → `switch-locale`, ссылка GitHub. Переносится в строки на узком экране, без бургера.
- Герой — по макету A: строка `heroNews` со ссылкой на MCP-страницу, `h1` из `title`, `lead`, кнопки `readDocs` (`t.docsHref`) и `tryHere` (`#demo`), строка `$ npm i -D vue-why-render` с кнопкой копирования (`navigator.clipboard.writeText`, на 1.5 с текст `copied`, без `alert`), справа окно магазина — статичная разметка (не Vue-компоненты песочницы): SearchBar (класс `wr-hot`), три ProductCard и Clock/CartBadge (класс `wr-flash` с задержками), под ним 4 строки причин (класс `wr-line`, появляются по очереди один раз), под окном `heroCaption`.
- CSS-классы анимаций (используются и в Task 3/4): `wr-flash`, `wr-hot`, `wr-line`, `wr-node`, `wr-wire`, `wr-play`; все отключаются в одном блоке `@media (prefers-reduced-motion: reduce)`.

- [ ] **Step 1: Write the failing tests** `test/site/landing.spec.ts`

```ts
// 1) 'panel sees playground components but no Site* ones':
//    mount App with createPinia() and VueWhyRender ({ enabled: true, includeMounts: true,
//    exclude: [/^Site/, 'App', 'Anonymous'] }) — те же опции, что в site/main.ts;
//    await flushPromises(); const names = getStats().map(s => s.name)
//    expect(names).toContain('ProductCard'); expect(names.some(n => n.startsWith('Site'))).toBe(false)
// 2) 'header links': SiteHeader с site.ru → ссылка Docs имеет href 'docs/ru/',
//    Changelog — 'https://github.com/dadashi44/vue-why-render/blob/main/CHANGELOG.md',
//    Playground — '#demo'; смена <select> на 'en' эмитит switch-locale с 'en'
// 3) 'copy button writes the install command': stub navigator.clipboard.writeText,
//    клик → вызван с 'npm i -D vue-why-render', текст кнопки/aria показывает site.en.copied
// 4) 'reduced motion disables every animation class': прочитать site/styles.css (fs),
//    найти блок @media (prefers-reduced-motion: reduce) и проверить, что в нём есть
//    .wr-flash, .wr-hot, .wr-line, .wr-node, .wr-wire, .wr-play
```

(Точные имена экспорта `getStats` и способ получить статистику — как в существующих тестах `test/panel.spec.ts`/`test/scanner.spec.ts`.)

- [ ] **Step 2: Run** `npx vitest run test/site/landing.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Install fonts** `npm i -D @fontsource/onest@^5 @fontsource/jetbrains-mono@^5`; импорт latin+cyrillic весов 400/500/600/700 (Onest) и 400/500 (JetBrains Mono) в `site/main.ts`; `--sans`/`--mono` в `styles.css`.
- [ ] **Step 4: Implement** `SiteHeader.vue`, `SiteHero.vue`, CSS (токены, шапка, герой, keyframes из макета A с цветами из Global Constraints), подключить в `App.vue` вместо старых `nav.langs` и `header.hero`.
- [ ] **Step 5: Run** tests, lint, vue-tsc, `npm run build:site` — Expected: PASS.
- [ ] **Step 6: Commit** `feat(site): header and animated hero`

### Task 3: Цепочка, пять причин, путь, MCP, футер

**Files:**
- Create: `site/components/SiteChain.vue`, `site/components/SiteCauses.vue`, `site/components/SitePath.vue`, `site/components/SiteAgents.vue`, `site/components/SiteFooter.vue`
- Modify: `site/App.vue`, `site/styles.css`, `site/i18n.ts` (удалить старые ключи, перечисленные в Task 1)
- Test: `test/site/landing.spec.ts` (дополнить)

**Interfaces:**
- Consumes: `SiteMessages` (Task 1), классы `wr-node`, `wr-wire` (Task 2).
- Produces: компоненты с props `{ t: SiteMessages }`; порядок в `App.vue`: Header, Hero, Chain, песочница `#demo` (без изменений логики), Causes, [место таймлайна — Task 4], Path, Agents, Footer. Секции «Отчёты», «Возможности», «Установка/Использование» и шаги под песочницей (`t.steps`) — удалить вместе с ключами (кроме демо-ключей песочницы).
- Цепочка (макет B, в тёмных цветах): 4 узла `cart.add(lamp)` / `stores/cart.ts:41`, `cart.items` / `length 2 → 3`, `subtotal` / `2 580 → 3 770`, `<CartBadge>` / `0.4 ms, 3rd time`; подписи узлов из `chainLabels`; сигнал по трём соединениям, цикл 6 с.
- Пять причин (макет A): строки `prop` ProductCard `price: 1290 → 1190`, `ref` SearchBar `query: "lam" → "lamp"`, `computed` Clock `time`, `pinia` CartBadge `cart.items.length: 2 → 3`, `router` ProductPage `params.id: /p/12 → /p/13`.
- Путь: `<ol>` из 4 шагов `t.path`, номера видимые (это последовательность). Шаг 3 содержит `expectRenders(Card).toBe(1)` — сверить имя метода с `src/test` (если `toBe` нет, взять реальный, например `toBeAtMost`).
- MCP: `agentsHeading`, `agentsLead`, ссылка `t.docsHref + 'guides/mcp/'`, блок `<pre>` с примером диалога из макета A.
- Футер: MIT, Docs, GitHub, npm (`https://www.npmjs.com/package/vue-why-render`), VS Code extension (ссылка как в `README.md`), Case (`t.caseLink`).

- [ ] **Step 1: Add failing tests**: 'MCP link follows the locale' (SiteAgents с `site['zh-CN']` → href `docs/zh-cn/guides/mcp/`); 'path is an ordered list of four steps'; 'old install section is gone' (App не содержит текста `defineNuxtConfig`).
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** components and CSS; remove old sections and keys.
- [ ] **Step 4: Run** tests from Task 1–3, lint, vue-tsc, build:site — Expected: PASS.
- [ ] **Step 5: Commit** `feat(site): cause chain, causes, path, agents and footer`

### Task 4: Таймлайн до/после

**Files:**
- Create: `site/timeline.ts`, `site/components/SiteTimeline.vue`
- Modify: `site/App.vue`, `site/styles.css`
- Test: `test/site/timeline.spec.ts`

**Interfaces:**
- Produces in `site/timeline.ts`:
  - `export type Scenario = 'home' | 'query'`
  - `export interface TimelineRow { name: string, scenario: Scenario, before: number, after: number }`
  - `export const bigplayRows: TimelineRow[]` — ровно: `card` home 600→10, `FinishOfRegistrationTimer` home 120→2, `ui-logo` query 20→0, `navbar` query 10→0, `footer` query 10→0
  - `export const MAX_TICKS = 40`
  - `export function ticks(count: number): number[]` — позиции отметок в процентах (0–100), длина `min(count, MAX_TICKS)`, равномерно, для 0 — `[]`
  - `export function isHot(count: number): boolean` — `count > 10`
- `SiteTimeline` props `{ t: SiteMessages }`; состояние `after: boolean`; две кнопки с `aria-pressed`; группы дорожек с подписями `scenarioHome`/`scenarioQuery`; справа точный счётчик `×N` (оранжевый, если `isHot`, иначе зелёный); итог «renders» — сумма; под таймлайном `noteBefore`/`noteAfter`; ссылка `readCase` → `cases/bigplay/`. Полоса `wr-play` бежит по дорожкам; смена состояния — `transition` opacity/transform отметок.

- [ ] **Step 1: Write the failing tests** `test/site/timeline.spec.ts`

```ts
expect(bigplayRows.map(r => [r.name, r.before, r.after])).toEqual([
    ['card', 600, 10], ['FinishOfRegistrationTimer', 120, 2], ['ui-logo', 20, 0], ['navbar', 10, 0], ['footer', 10, 0],
])
expect(ticks(600)).toHaveLength(40)
expect(ticks(2)).toHaveLength(2)
expect(ticks(0)).toEqual([])
expect(ticks(40).every(p => p >= 0 && p <= 100)).toBe(true)
// компонент: по умолчанию «до», итог 760; клик по кнопке «после» → aria-pressed меняется,
// итог 12, дорожка card содержит 10 отметок, счётчик ui-logo «×0»;
// ни одна дорожка не содержит больше 40 отметок при «до»
```

- [ ] **Step 2: Run** `npx vitest run test/site/timeline.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `site/timeline.ts`, `SiteTimeline.vue`, CSS; вставить между Causes и Path.
- [ ] **Step 4: Run** all site tests, lint, vue-tsc, build:site — Expected: PASS.
- [ ] **Step 5: Commit** `feat(site): before/after timeline with BIGPLAY numbers`

### Task 5: Счётчик GoatCounter и CHANGELOG

**Files:**
- Create: `site/public/count.js`, `test/site/count.spec.ts`
- Modify: `site/index.html`, `site/cases/bigplay/index.html`, `docs-site/astro.config.mjs`, `docs-site/test/build.test.mjs`, `CHANGELOG.md`

**Interfaces:**
- `site/public/count.js` — обычный (не модуль) скрипт без зависимостей. Логика: если `location.hostname !== 'vue-why-render.js.org'` или `navigator.webdriver` — ничего не делать; иначе `new Image().src = 'https://dadashi44.goatcounter.com/count?' + URLSearchParams({ p: location.pathname, t: document.title, r: document.referrer, s: String(screen.width), rnd: String(Math.random()).slice(2) })`. Query (`?lang=`) не отправляется.
- Подключение: `<script async src="…count.js"></script>` — в `site/index.html` и кейсе путь через `%BASE_URL%count.js` (Vite) или эквивалент, корректный для обоих `SITE_BASE`; в Starlight — `head: [{ tag: 'script', attrs: { src: `${SITE_BASE ?? '/'}count.js`, async: true } }]`.

- [ ] **Step 1: Write the failing tests** `test/site/count.spec.ts`: прочитать файл, выполнить через `new Function('location','navigator','document','screen','Image', source)` с подделками:
  - hostname `vue-why-render.js.org`, pathname `/docs/ru/`, search `?lang=ru` → создан один `Image` с `src`, начинающимся с `https://dadashi44.goatcounter.com/count?`, параметр `p` = `/docs/ru/`, в `src` нет `lang=`
  - hostname `localhost` → ни одного `Image`
  - hostname `dadashi44.github.io` → ни одного `Image`
  - `navigator.webdriver = true` → ни одного `Image`
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** `count.js`, подключение в двух HTML и в Starlight `head`; в `docs-site/test/build.test.mjs` добавить проверку: `dist-site/count.js` существует, `dist-site/index.html`, `dist-site/cases/bigplay/index.html` и `dist-site/docs/index.html` ссылаются на `count.js` (с учётом `SITE_BASE`).
- [ ] **Step 4: CHANGELOG** `[Unreleased]` → «Изменено: новая главная сайта; добавлен счётчик посещений GoatCounter (без cookies)» (en-формулировки в стиле файла).
- [ ] **Step 5: Run** vitest, lint, vue-tsc, и с Node 22.23.4 `npm run build:site && npm run docs:build && npm run docs:test` дважды: без `SITE_BASE` и с `SITE_BASE=/vue-why-render/` — Expected: PASS.
- [ ] **Step 6: Commit** `feat(site): goatcounter page views without third-party script`
