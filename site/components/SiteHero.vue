<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import type { SiteMessages } from '../i18n'

const props = defineProps<{ t: SiteMessages }>()

const install = 'npm i -D vue-why-render'
const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

// Строка новости: версия выделена акцентом, остальное — после неё.
const [version, ...rest] = props.t.heroNews.split(' ')
const news = { version, text: rest.join(' ') }

async function copy(): Promise<void> {
    try {
        await navigator.clipboard.writeText(install)
    }
    catch {
        // Без доступа к буферу команду всё равно видно и можно выделить руками.
        return
    }
    copied.value = true
    clearTimeout(timer)
    timer = setTimeout(() => (copied.value = false), 1500)
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
    <section class="site-hero">
        <div class="site-hero__text">
            <p class="site-hero__news">
                <a :href="t.docsHref + 'guides/mcp/'"><b>{{ news.version }}</b> {{ news.text }}</a>
            </p>

            <h1 class="site-hero__title">
                {{ t.title[0] }} {{ t.title[1] }}
            </h1>

            <p class="site-hero__lead">
                {{ t.lead }}
            </p>

            <div class="site-hero__actions">
                <a class="site-btn" :href="t.docsHref">{{ t.readDocs }}</a>
                <a class="site-btn site-btn--ghost" href="#demo">{{ t.tryHere }}</a>
            </div>

            <div class="hero-install">
                <code><span class="hero-install__prompt">$</span> {{ install }}</code>
                <button
                    class="hero-install__copy"
                    type="button"
                    :aria-label="copied ? t.copied : t.copyInstall"
                    @click="copy"
                >
                    <span v-if="copied" class="hero-install__done">{{ t.copied }}</span>
                    <svg v-else width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="11" height="11" rx="2" />
                        <path d="M5 15V5a1 1 0 0 1 1-1h10" />
                    </svg>
                </button>
                <!-- aria-label меняется на кнопке в фокусе, но читалки этого не объявляют. -->
                <span class="visually-hidden" role="status" aria-live="polite">{{ copied ? t.copied : '' }}</span>
            </div>
        </div>

        <!-- Иллюстрация на CSS, не компоненты песочницы: анимация не вызывает рендеров. -->
        <figure class="site-hero__shot">
            <div class="shop" aria-hidden="true">
                <div class="shop__bar">
                    <span class="shop__dot" /><span class="shop__dot" /><span class="shop__dot" />
                    <span class="shop__url">shop.local/catalog</span>
                </div>

                <div class="shop__grid">
                    <div class="shop__box shop__box--wide wr-hot">
                        <span>SearchBar</span><span class="shop__count shop__count--hot">×48</span>
                    </div>
                    <div class="shop__box shop__box--card wr-flash" style="--wr-delay: .2s">
                        <span>ProductCard</span><span class="shop__count">×3</span>
                    </div>
                    <div class="shop__box shop__box--card wr-flash" style="--wr-delay: 1.1s">
                        <span>ProductCard</span><span class="shop__count">×3</span>
                    </div>
                    <div class="shop__box shop__box--card wr-flash" style="--wr-delay: 1.3s">
                        <span>ProductCard</span><span class="shop__count">×2</span>
                    </div>
                    <div class="shop__box shop__box--two wr-flash" style="--wr-delay: 2.4s">
                        Clock
                    </div>
                    <div class="shop__box wr-flash" style="--wr-delay: 3.2s">
                        CartBadge
                    </div>
                </div>

                <div class="shop__log">
                    <div class="wr-line" style="--wr-delay: .4s">
                        <span class="shop__hot">SearchBar</span> <span class="shop__kind">state ref</span> query: "lam" → "lamp"
                    </div>
                    <div class="wr-line" style="--wr-delay: 1.2s">
                        <span class="shop__name">ProductCard</span> <span class="shop__kind">prop</span> price: 1290 → 1190
                    </div>
                    <div class="wr-line" style="--wr-delay: 2s">
                        <span class="shop__name">Clock</span> <span class="shop__kind">computed</span> time
                    </div>
                    <div class="wr-line" style="--wr-delay: 2.8s">
                        <span class="shop__name">CartBadge</span> <span class="shop__kind">store</span> cart.items.length: 2 → 3
                    </div>
                </div>
            </div>

            <figcaption class="site-hero__caption">
                {{ t.heroCaption }}
            </figcaption>
        </figure>
    </section>
</template>
