<script setup lang="ts">
import type { Locale } from 'vue-why-render'
import { site, siteLocales } from '../i18n'
import type { SiteMessages } from '../i18n'

defineProps<{ t: SiteMessages, locale: Locale }>()

const emit = defineEmits<{ 'switch-locale': [next: Locale] }>()

function onChange(event: Event): void {
    emit('switch-locale', (event.target as HTMLSelectElement).value as Locale)
}
</script>

<template>
    <header class="site-header">
        <div class="site-header__inner">
            <a class="site-header__logo" href="./">
                <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
                    <path d="M3 4h5l5 9 5-9h5L13 22z" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" />
                    <circle cx="13" cy="13" r="2.2" fill="var(--warn)" />
                </svg>
                vue-why-render
            </a>

            <nav class="site-header__nav" aria-label="Main">
                <a :href="t.docsHref">{{ t.nav.docs }}</a>
                <a href="#demo">{{ t.nav.playground }}</a>
                <!-- Кейс есть только на русском: в других языках помечаем ссылку. -->
                <a href="cases/bigplay/" hreflang="ru">
                    {{ t.nav.caseStudy }}<span v-if="locale !== 'ru'" class="site-header__mark"> (ru)</span>
                </a>
                <a href="https://github.com/dadashi44/vue-why-render/blob/main/CHANGELOG.md">{{ t.nav.changelog }}</a>
            </nav>

            <div class="site-header__tools">
                <label class="visually-hidden" for="site-lang">{{ t.languageLabel }}</label>
                <select id="site-lang" class="site-header__lang" :value="locale" @change="onChange">
                    <option v-for="code in siteLocales" :key="code" :value="code">
                        {{ site[code].name }}
                    </option>
                </select>

                <a class="site-header__github" href="https://github.com/dadashi44/vue-why-render">
                    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                        <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z" />
                    </svg>
                    GitHub
                </a>
            </div>
        </div>
    </header>
</template>
