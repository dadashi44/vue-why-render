# Project Ideas — Vue Ecosystem Tooling

> Результат ресерча GitHub issues, State of Vue Survey 2026, Reddit/HN.
> Дата: 2026-10-22

---

## 1. Vue SFC Analyzer на Rust

**Спрос:**
- OXC: "better vue support" — 40 reactions (#15761)
- OXC: eslint-plugin-vue имплементация — 15 reactions (#11440)
- Biome: HTML/Vue парсинг — 23 reactions (#4726)
- Biome: не форматирует embedded snippets в .vue — 6 reactions (#10420)
- Biome: нет `vue/no-unused-emit-declarations` — 5 reactions (#6306)

**Суть:** Быстрый парсер/анализатор `.vue` файлов на Rust:
- Линтинг Vue-специфичных паттернов (unused emits, side effects в computed, valid-define-props)
- Анализ template + script + style в едином проходе
- Плагин для OXC/Biome или standalone CLI

**Маркетинг:** "The missing piece for Rust-based Vue tooling"

**Сложность:** Высокая — нужен парсер для Vue template syntax, script setup, CSS scoped
**Конкуренция:** Низкая — никто полноценно не закрыл
**Потенциал звёзд:** Высокий (если сделать плагин к OXC/Biome — попадаешь в их экосистему)

---

## 2. Vite Bundle Analyzer на Rust

**Спрос:**
- Vite CSS ordering при dynamic import — 82 reactions (#3924)
- Vite tree-shaking в dev mode — 56 reactions (#8237)
- Vite dev/prod CSS порядок различается — 36 reactions (#21903)
- Nuxt `_nuxt/*` chunk hash не уникален — 9 reactions (#36136)

**Суть:** Быстрый анализатор бандла:
- Визуализация что тянется, дублирование модулей
- Детекция CSS конфликтов и нарушений каскада
- Сравнение dev vs prod бандлов
- Интеграция с Vite как плагин

**Маркетинг:** "Bundle analysis 100x faster than webpack-bundle-analyzer"

**Сложность:** Средняя
**Конкуренция:** Средняя (есть rollup-plugin-visualizer, vite-bundle-visualizer)
**Потенциал звёзд:** Средний

---

## 3. vue-why-render + Rust/WASM (расширение текущего проекта)

**Спрос:**
- React имеет `why-did-you-render` + React DevTools Profiler — у Vue **нет аналога**
- Vue DevTools tab не показывается — 48 reactions (vuejs/devtools)
- Vue DevTools вешает браузер — 6 reactions
- State of Vue Survey: 17% жалуются на тулинг
- Reddit: "re-render debugging" — одна из главных дыр vs React

**Суть:** Расширить vue-why-render:
- WASM-бэкенд на Rust для быстрого анализа render-дерева (опыт с `@takumi-rs/wasm` уже есть)
- Визуализация цепочек реактивности (какой ref/computed вызвал re-render)
- Перформанс-профайлер: flamegraph рендеров по компонентам
- Интеграция с Vue DevTools / Nuxt DevTools

**Маркетинг:**
- "React has why-did-you-render. Now Vue does too — but faster, with Rust."
- Уже есть проект, аудитория, Nuxt DevTools tab
- Используется в собственном продакшене (clientFrontend)

**План продвижения с WASM:**
1. **Фаза 1 — "Rust inside" badge.** Добавить WASM-бэкенд для тяжёлых вычислений (diff render trees, trace reactivity chains). Это даёт маркетинговый хук: "Powered by Rust/WASM"
2. **Фаза 2 — Benchmarks.** Замерить и показать: "Analyzes 10k components in Xms" vs чистый JS. Бенчмарки — контент для Twitter/X, Reddit, HN
3. **Фаза 3 — Reactivity Visualizer.** Уникальная фича, которой нет ни у кого: граф зависимостей ref→computed→watch→component. Это "вау-фича" для демо-гифки
4. **Фаза 4 — Vue DevTools integration.** Отдельная вкладка в Vue DevTools (не только Nuxt). Это попадание в core экосистему
5. **Фаза 5 — VS Code extension.** Inline подсказки "this component re-rendered because X changed". Прямо в редакторе

**Каналы продвижения:**
- Пост на Reddit r/vuejs с GIF/видео
- Twitter/X: тег @vuejs, @antaborin (Evan You)
- vue-awesome list (submit PR)
- Dev.to / Habr статья "How we debug Vue re-renders with Rust/WASM"
- Discord: Vue Land, Nuxt, VueUse серверы
- Hacker News: "Show HN: vue-why-render — Rust-powered re-render debugger for Vue"

**Сложность:** Средняя (WASM-опыт уже есть)
**Конкуренция:** Нулевая
**Потенциал звёзд:** Высокий

---

## 4. AI/LLM SDK для Vue

**Спрос:**
- Vercel AI SDK — React-first, Vue поддержка минимальна
- LangChain UI components — React-only
- Reddit: "Every time I want to use a new tool, the first question is 'does it support Vue?'"

**Суть:** Vue composables / компоненты для работы с LLM:
- `useChat()`, `useCompletion()`, `useAssistant()` — composables
- Streaming-компоненты: `<AiMessage>`, `<AiInput>`, `<AiThread>`
- Поддержка OpenAI, Anthropic, local LLMs
- SSR-совместимость (Nuxt)

**Маркетинг:** "Vercel AI SDK, but for Vue"

**Сложность:** Средняя
**Конкуренция:** Низкая (есть неофициальные порты, но не mainstream)
**Потенциал звёзд:** Высокий (AI-хайп + Vue-дефицит = взрывная комбинация)

---

## 5. Headless UI Components для Vue

**Спрос:**
- React: Radix, shadcn/ui, React Aria, Ark UI, Headless UI, Mantine
- Vue: Radix Vue (порт), shadcn-vue (порт), Headless UI — качество и поддержка отстают
- State of Vue Survey: 22% хотят официальную component library

**Суть:** Headless UI-примитивы:
- a11y из коробки (ARIA patterns)
- Zero styling — пользователь стилизует сам
- Composable-архитектура (не renderless components как в Vue 2)
- Tailwind-готовые пресеты

**Маркетинг:** "Radix-quality primitives, built for Vue from scratch (not a port)"

**Сложность:** Высокая (a11y — это огромный объём работы)
**Конкуренция:** Средняя (Radix Vue существует, но это порт)
**Потенциал звёзд:** Средний (перенасыщенный рынок UI-библиотек)

---

## 6. Vue Server Components

**Спрос:**
- React Server Components (RSC) в Next.js — mainstream
- Nuxt server components — experimental, ограниченные
- Reddit: "React is moving to RSC, what is Vue's answer?"
- Nuxt server component roadmap — 33 reactions (#19772)

**Суть:** Фреймворк/плагин для серверных компонентов:
- Серверные компоненты с seamless client/server composition
- Streaming SSR
- Partial hydration / Islands architecture

**Маркетинг:** "Vue's answer to React Server Components"

**Сложность:** Очень высокая (это уровень фреймворка, не библиотеки)
**Конкуренция:** Nuxt команда работает над этим
**Потенциал звёзд:** Высокий, но риск — Nuxt может сделать это сами

---

## 7. Vue 2→3 Migration Tool

**Спрос:**
- State of Vue Survey: 25%+ жалуются на миграцию
- Vue 2 EOL с декабря 2023, но ~20% проектов всё ещё на Vue 2
- Свой tournament-admin — готовый тест-кейс

**Суть:** AST-трансформер на Rust/Go:
- Options API → Composition API
- Vuex → Pinia
- Vue Router 3 → 4
- Vue CLI → Vite
- Автоматический codemod с отчётом

**Маркетинг:** "Migrate your Vue 2 app to Vue 3 in minutes, not months"

**Сложность:** Высокая
**Конкуренция:** Низкая (есть vue-codemod, но не полноценный)
**Потенциал звёзд:** Средний (аудитория сокращается по мере миграции)

---

## Приоритет (личная рекомендация)

| # | Идея | Реалистичность | Потенциал | Рекомендация |
|---|------|---------------|-----------|-------------|
| 1 | **vue-why-render + WASM** | Высокая | Высокий | **Начать с этого** |
| 2 | **AI/LLM SDK для Vue** | Средняя | Высокий | Второй проект |
| 3 | **Vue SFC Analyzer (Rust)** | Средняя | Высокий | Можно параллельно |
| 4 | Vue 2→3 Migration Tool | Средняя | Средний | Нишевый |
| 5 | Vite Bundle Analyzer | Средняя | Средний | Конкуренция |
| 6 | Headless UI | Низкая | Средний | Слишком много работы |
| 7 | Server Components | Низкая | Высокий | Nuxt сделает сами |
