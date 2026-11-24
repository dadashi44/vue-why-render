<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { Locale } from 'vue-why-render'
import LiveClock from '../playground/components/LiveClock.vue'
import ProductCard from '../playground/components/ProductCard.vue'
import StaticNote from '../playground/components/StaticNote.vue'
import CartSummary from './CartSummary.vue'
import SiteHeader from './components/SiteHeader.vue'
import SiteAgents from './components/SiteAgents.vue'
import SiteCauses from './components/SiteCauses.vue'
import SiteChain from './components/SiteChain.vue'
import SiteFooter from './components/SiteFooter.vue'
import SiteHero from './components/SiteHero.vue'
import SitePath from './components/SitePath.vue'
import { useCart } from './stores/cart'
import { detectLocale, site } from './i18n'

const locale = detectLocale()
const t = site[locale]

// Язык панели задаётся при подключении плагина и на лету не меняется,
// поэтому переключение — это перезагрузка с ?lang. Заодно ссылкой
// на нужный язык можно поделиться.
function switchTo(next: Locale): void {
    const url = new URL(window.location.href)
    url.searchParams.set('lang', next)
    window.location.href = url.toString()
}

const catalogue: Record<Locale, { currency: string, items: { id: number, title: string, price: number }[] }> = {
    'en': {
        currency: '$',
        items: [
            { id: 1, title: 'Keyboard', price: 54 },
            { id: 2, title: 'Mouse', price: 21 },
            { id: 3, title: 'Monitor', price: 240 },
        ],
    },
    'ru': {
        currency: '₽',
        items: [
            { id: 1, title: 'Клавиатура', price: 5400 },
            { id: 2, title: 'Мышь', price: 2100 },
            { id: 3, title: 'Монитор', price: 24000 },
        ],
    },
    'zh-CN': {
        currency: '¥',
        items: [
            { id: 1, title: '键盘', price: 380 },
            { id: 2, title: '鼠标', price: 150 },
            { id: 3, title: '显示器', price: 1700 },
        ],
    },
}

const query = ref('')
const cart = useCart()
const tick = ref(0)
const products = ref(catalogue[locale].items)
const currency = catalogue[locale].currency

const filtered = computed(() =>
    products.value.filter(product => product.title.toLowerCase().includes(query.value.toLowerCase())),
)

const timer = setInterval(() => tick.value++, 2000)
onBeforeUnmount(() => clearInterval(timer))

// Каждый рендер отдаёт новый объект с тем же содержимым: статический литерал
// Vue вынес бы в константу, а результат вызова функции — нет.
// Панель пометит такой проп как «новая ссылка, значение то же».
function makeBadge(): { text: string } {
    return { text: 'new' }
}

function addToCart(): void {
    const product = products.value[0]
    if (product) cart.add(product.title, product.price)
}

function raisePrice(id: number): void {
    const product = products.value.find(item => item.id === id)
    if (product) product.price += 100
}
</script>

<template>
    <SiteHeader :t="t" :locale="locale" @switch-locale="switchTo" />

    <main>
        <SiteHero :t="t" />

        <SiteChain :t="t" />

        <div class="wrap">
            <section id="demo">
                <h2>{{ t.demoHeading }}</h2>

                <p class="lead">
                    {{ t.demoLead }}
                </p>

                <div class="hint">
                    <span><b>{{ t.hintLabel }}</b> {{ t.hint }}</span>
                </div>

                <div class="demo">
                    <div class="demo__row">
                        <input v-model="query" :placeholder="t.filterPlaceholder">
                        <span class="demo__meta">{{ t.clock }} <LiveClock /></span>
                        <span class="demo__meta">{{ t.tick }} {{ tick }}</span>
                    </div>

                    <ul>
                        <ProductCard
                            v-for="product in filtered"
                            :key="product.id"
                            :product="product"
                            :badge="makeBadge()"
                            :currency="currency"
                            @raise="raisePrice(product.id)"
                        />
                    </ul>

                    <div class="demo__row">
                        <button type="button" @click="addToCart()">
                            {{ t.addToCart }}
                        </button>
                    </div>
                    <CartSummary :label="t.cartLabel" :clear-label="t.clearCart" :currency="currency" />

                    <StaticNote>{{ t.staticNote }}</StaticNote>
                </div>
            </section>
        </div>

        <SiteCauses :t="t" />

        <!-- Сюда Task 4 вставляет таймлайн «до/после». -->

        <SitePath :t="t" />
        <SiteAgents :t="t" />
    </main>

    <SiteFooter :t="t" />
</template>
