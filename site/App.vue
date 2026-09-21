<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import LiveClock from '../playground/components/LiveClock.vue'
import ProductCard from '../playground/components/ProductCard.vue'
import StaticNote from '../playground/components/StaticNote.vue'

const query = ref('')
const tick = ref(0)
const products = ref([
    { id: 1, title: 'Клавиатура', price: 5400 },
    { id: 2, title: 'Мышь', price: 2100 },
    { id: 3, title: 'Монитор', price: 24000 },
])

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
        <header class="hero">
            <span class="hero__tag">Vue 3.3+ · без рантайм-зависимостей</span>

            <h1>Видно, какие компоненты<br>перерисовываются — и почему</h1>

            <p class="lead">
                Аналоги умеют мигать рамкой вокруг обновившегося компонента. Этого хватает,
                чтобы заметить проблему, но не чтобы её починить: остаётся вопрос «а что
                вообще изменилось?». <code>vue-why-render</code> отвечает на него — называет
                конкретную реактивную зависимость, которая дёрнула рендер.
            </p>

            <pre class="hero__sample">ProductCard ×7 · 2.4ms · <b>badge</b>
└─ проп badge: { text } → { text } — <b>новая ссылка, значение то же</b></pre>

            <div class="buttons">
                <a class="btn" href="#demo">Попробовать вживую</a>
                <a class="btn btn--ghost" href="https://github.com/dadashi44/vue-why-render">GitHub</a>
            </div>
        </header>

        <section id="demo">
            <h2>Живая песочница</h2>

            <p class="lead">
                Панель справа внизу — настоящая, она сканирует этот же кусок страницы.
                Всё, что ниже, обычные компоненты Vue.
            </p>

            <div class="hint">
                <span>
                    <b>Что делать:</b> печатай в поле — перерисуется только список,
                    а часы рядом останутся нетронутыми. Потом нажми <b>+100</b> и найди
                    в панели строку про <b>badge</b>: проп меняется каждый рендер, хотя
                    значение в нём то же самое. Это и есть самый частый источник лишних рендеров.
                </span>
            </div>

            <div class="demo">
                <div class="demo__row">
                    <input v-model="query" placeholder="фильтр по названию">
                    <span class="demo__meta">часы: <LiveClock /></span>
                    <span class="demo__meta">тик: {{ tick }}</span>
                </div>

                <ul>
                    <ProductCard
                        v-for="product in filtered"
                        :key="product.id"
                        :product="product"
                        :badge="makeBadge()"
                        @raise="raisePrice(product.id)"
                    />
                </ul>

                <StaticNote />
            </div>

            <ol class="steps">
                <li>Заголовок панели сворачивает и разворачивает её.</li>
                <li>Вкладки внутри — топ по перерисовкам, топ по времени, дерево и лента событий.</li>
                <li>Цвет рамки вокруг компонента идёт от зелёного к красному по частоте.</li>
            </ol>
        </section>

        <section>
            <h2>Что внутри</h2>

            <div class="features">
                <div class="feature">
                    <h3>Причина, а не факт</h3>
                    <p>Имя пропа, рефа, ключа стора или индекса массива — плюс старое и новое значение.</p>
                </div>
                <div class="feature">
                    <h3>Новая ссылка, значение то же</h3>
                    <p>Отдельная пометка для самого частого источника лишних рендеров.</p>
                </div>
                <div class="feature">
                    <h3>Оверлей</h3>
                    <p>Рамка вокруг перерисованного компонента, цвет — от зелёного к красному по частоте.</p>
                </div>
                <div class="feature">
                    <h3>Панель</h3>
                    <p>Топ по перерисовкам и по времени, дерево компонентов с суммой по поддереву, лента событий.</p>
                </div>
                <div class="feature">
                    <h3>Прыжок в IDE</h3>
                    <p>Клик по строке открывает SFC в редакторе через дев-сервер.</p>
                </div>
                <div class="feature">
                    <h3>Свои отчёты</h3>
                    <p><code>getStats()</code>, <code>getEvents()</code>, колбэк <code>onRender</code>.</p>
                </div>
            </div>
        </section>

        <section>
            <h2>Установка</h2>

            <pre>npm i -D vue-why-render</pre>

            <p class="lead" style="margin-top: 14px">
                Нужен Vue 3.3+. Рантайм-зависимостей у пакета нет, в зависимостях
                он один. Есть и <a href="https://www.npmjs.com/package/vue-why-render">страница
                    в npm</a>, и тарбол на
                <a href="https://github.com/dadashi44/vue-why-render/releases">странице релизов</a>,
                если ставить из реестра почему-то нельзя.
            </p>

            <h2 style="margin-top: 36px">Подключение</h2>

            <pre>import { createApp } from 'vue'
import VueWhyRender from 'vue-why-render'
import App from './App.vue'

const app = createApp(App)

if (import.meta.env.DEV) app.use(VueWhyRender)

app.mount('#app')</pre>

            <p class="lead" style="margin-top: 14px">
                Проверка на <code>import.meta.env.DEV</code> обязательна: пакет не определяет
                режим сборки сам, и гасить его в проде должен вызывающий код. Зато со
                статическим флагом сборщик вырезает и сам импорт.
            </p>
        </section>

        <footer class="site-foot">
            MIT ·
            <a href="https://github.com/dadashi44/vue-why-render">исходники</a> ·
            <a href="https://github.com/dadashi44/vue-why-render/issues">issues</a>
        </footer>
    </div>
</template>
