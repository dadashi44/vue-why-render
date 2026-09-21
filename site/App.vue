<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { Locale } from 'vue-why-render'
import LiveClock from '../playground/components/LiveClock.vue'
import ProductCard from '../playground/components/ProductCard.vue'
import StaticNote from '../playground/components/StaticNote.vue'
import { detectLocale, site, siteLocales } from './i18n'

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

function raisePrice(id: number): void {
    const product = products.value.find(item => item.id === id)
    if (product) product.price += 100
}
</script>

<template>
    <div class="wrap">
        <nav class="langs">
            <button
                v-for="code in siteLocales"
                :key="code"
                class="langs__item"
                :class="{ 'langs__item--active': code === locale }"
                type="button"
                @click="switchTo(code)"
            >
                {{ site[code].name }}
            </button>
        </nav>

        <header class="hero">
            <span class="hero__tag">{{ t.tag }}</span>

            <h1>{{ t.title[0] }}<br>{{ t.title[1] }}</h1>

            <p class="lead">
                {{ t.lead }}
            </p>

            <pre class="hero__sample">ProductCard ×7 · 2.4ms · <b>badge</b>
└─ {{ t.sampleNote }}: { text } → { text } — <b>{{ t.sampleReason }}</b></pre>

            <div class="buttons">
                <a class="btn" href="#demo">{{ t.tryIt }}</a>
                <a class="btn btn--ghost" href="https://github.com/dadashi44/vue-why-render">GitHub</a>
            </div>
        </header>

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

                <StaticNote>{{ t.staticNote }}</StaticNote>
            </div>

            <ol class="steps">
                <li v-for="(step, index) in t.steps" :key="index">
                    {{ step }}
                </li>
            </ol>
        </section>

        <section>
            <h2>{{ t.featuresHeading }}</h2>

            <div class="features">
                <div v-for="feature in t.features" :key="feature.title" class="feature">
                    <h3>{{ feature.title }}</h3>
                    <!-- eslint-disable-next-line vue/no-v-html -- строки свои, из словаря рядом -->
                    <p v-html="feature.text" />
                </div>
            </div>
        </section>

        <section>
            <h2>{{ t.installHeading }}</h2>

            <pre>npm i -D vue-why-render</pre>

            <p class="lead" style="margin-top: 14px">
                {{ t.installNote[0] }}
                <a href="https://www.npmjs.com/package/vue-why-render">{{ t.installNote[1] }}</a>
                {{ t.installNote[2] }}
            </p>

            <h2 style="margin-top: 36px">
                {{ t.usageHeading }}
            </h2>

            <pre>import { createApp } from 'vue'
import VueWhyRender from 'vue-why-render'
import App from './App.vue'

const app = createApp(App)

if (import.meta.env.DEV) app.use(VueWhyRender, { locale: '{{ locale }}' })

app.mount('#app')</pre>

            <!-- eslint-disable-next-line vue/no-v-html -- строка своя, из словаря рядом -->
            <p class="lead" style="margin-top: 14px" v-html="t.usageNote" />
        </section>

        <footer class="site-foot">
            {{ t.footer }} ·
            <a href="https://github.com/dadashi44/vue-why-render">{{ t.sources }}</a> ·
            <a href="https://github.com/dadashi44/vue-why-render/issues">issues</a>
        </footer>
    </div>
</template>
