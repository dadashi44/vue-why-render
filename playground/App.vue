<script setup lang="ts">
import { computed, ref } from 'vue'
import LiveClock from './components/LiveClock.vue'
import ProductCard from './components/ProductCard.vue'
import StaticNote from './components/StaticNote.vue'

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

setInterval(() => tick.value++, 2000)

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
    <main>
        <h1>vue-why-render playground</h1>

        <p>
            Печатай в поле — перерисуется только список.
            Тикающие часы рядом покажут, что соседние компоненты не задеты.
        </p>

        <input v-model="query" placeholder="фильтр">
        <LiveClock />
        <!-- Тик нужен в разметке: без него App не перерисовывается,
             и случай «новая ссылка» в карточках не наступает. -->
        <span>тик: {{ tick }}</span>

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
    </main>
</template>
