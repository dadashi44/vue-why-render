# Outreach drafts

Черновики для публикаций. Лежат в ветке `release`, в `main` не едут.

Правила, на которых они написаны: польза в первых строках, ссылка после неё,
авторство раскрыто явно, никаких превосходных степеней. Две ссылки — потолок.

---

## 1. Ответ в тред «Vue track rerendering tool»

<https://www.reddit.com/r/vuejs/comments/1ivuojw/vue_track_rerendering_tool/>

Человек спрашивает, есть ли для Vue аналог [react-scan](https://github.com/aidenybai/react-scan).

```
Closest built-in thing is the "Highlight updates" toggle in Vue DevTools, but
it's the same deal as react-scan — it flashes a border and leaves you guessing
what actually changed.

That gap annoyed me enough that I built one: https://github.com/dadashi44/vue-why-render

The nice part is that Vue makes this easier than React. There's a `renderTriggered`
hook that hands you `{ target, type, key, oldValue, newValue }` — so the framework
already knows which reactive dependency woke the component up, you just have to
translate it into something readable. Instead of "this re-rendered" you get:

  ProductCard ×7 · 2.4ms · badge
  └─ prop badge: { text } → { text } — new reference, same value

That last line is the one I actually wanted — a parent passing a fresh object
literal every render, which a border flash can't show you.

Dev-only by design (the hook doesn't fire in prod builds at all), MIT, no runtime deps.
Playground if you want to poke at it: https://dadashi44.github.io/vue-why-render/

Obviously I wrote it, so take it with the appropriate grain of salt.
```

Треду семь месяцев, живого обсуждения там нет. Ценность — в индексации: страница
находится по запросу «vue track rerendering», а такие страницы охотно цитируют
и поисковики, и языковые модели. Всплеска не жди.

---

## 2. Свой пост в r/vuejs

Канал сильнее ответа в старом треде. Формат, который там заходит, — история
проблемы, а не анонс. Приложить гифку из `docs/demo.gif`.

**Заголовок:**

```
I spent a week hunting a re-render in a Nuxt app. It was an object literal in a prop.
```

**Тело:**

```
Half the page was re-rendering on every tick and I could not figure out why.
Vue DevTools has a "Highlight updates" toggle, so I could see *what* was
re-rendering — but not *why*, which is the only part I actually needed.

Turns out Vue already knows. There is a `renderTriggered` hook on every component,
and Vue hands it `{ target, type, key, oldValue, newValue }` — the object, the key,
and the values before and after. In React you have to diff props and guess. In Vue
the framework just tells you, and almost nothing surfaces it.

So I wrote the translation layer. The raw event is not readable on its own: a ref
shows up as `value` until you look its name up in `setupState`, a Pinia store needs
`$id` to become `cart.items`, an array index needs brackets. Once that is done you
get lines like:

  ProductCard ×7 · 2.4ms · badge
  └─ prop badge: { text } → { text } — new reference, same value

The culprit in my case was that last pattern: the parent was building a fresh object
literal in the template on every render. Same content, new reference, so every child
re-rendered. A border flash cannot show you that. The exact prop name can.

MIT, no runtime deps, dev-only by design (the hook does not fire in production
builds at all).

  npm i -D vue-why-render

Source: https://github.com/dadashi44/vue-why-render
npm: https://www.npmjs.com/package/vue-why-render
Live playground, the panel on it is real: https://dadashi44.github.io/vue-why-render/

Happy to hear where it breaks on a bigger app — mine is the only real one it has
been through so far.
```

Последняя строка не про скромность, а про дело: приглашение к issues читается как
открытость, а не как реклама, и часто приносит первые реальные баг-репорты.

Про «две ссылки — потолок» из шапки: это правило для комментариев в чужих тредах,
где ссылки читаются как спам. В своём посте про свой проект три ссылки — репозиторий,
npm и демо — это норма и ровно то, что читатель ищет. Команда установки отдельной
строкой тоже помогает: половина людей копирует её и не идёт никуда дальше.

---

## 3. Короткая версия для HN / X / Bluesky

```
Vue gives you the reason a component re-rendered — the `renderTriggered` hook hands
you the prop, ref or store key plus old and new value. Almost nothing surfaces it,
so I built a tool that does.

Catches the classic "same content, new object literal in a prop" case by name:
  prop badge: { text } → { text } — new reference, same value

https://github.com/dadashi44/vue-why-render
```

Для Show HN заголовок: `Show HN: See which Vue components re-render, and why`.
Идти туда только когда будет Nuxt-модуль — с ним история цельнее.

---

## Чего не делать

Покупные звёзды и взаимные подписки, рассылка в личку мейнтейнерам, ссылки в чужих
issues, «оптимизация под ИИ» от агентств, `llms.txt` на сайте. Первое — бан, второе
и третье — репутация, четвёртое и пятое — выброшенные деньги: ни один крупный
провайдер `llms.txt` не читает.

Что работает вместо этого: развёрнутые ответы на StackOverflow по запросам вида
«why does my Vue component re-render», PR в awesome-vue, статья на dev.to про
**проблему**, а не про пакет.

---

## Статус аккаунта Reddit

Аккаунт забанен при попытке опубликовать пост из раздела 2. Формулировка
«removed by Reddit's filters» — это общесайтовый антиспам, не модерация саба.
Вероятная причина: ссылки в первом же посте с нового аккаунта.

Апелляция: <https://reddit.com/appeals>. Новый аккаунт до её разрешения не заводить —
Reddit связывает аккаунты по IP и устройству, это ban evasion и уже необратимо.

Пока Reddit недоступен, работают: dev.to, PR в awesome-vue, Vue Land Discord,
ответы на StackOverflow.
