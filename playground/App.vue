<script setup lang="ts">
import { computed, ref } from 'vue'
import LiveClock from './components/LiveClock.vue'
import ProductCard from './components/ProductCard.vue'
import StaticNote from './components/StaticNote.vue'

const query = ref('')
const products = ref([
    { id: 1, title: 'Клавиатура', price: 5400 },
    { id: 2, title: 'Мышь', price: 2100 },
    { id: 3, title: 'Монитор', price: 24000 },
])

const filtered = computed(() =>
    products.value.filter(product => product.title.toLowerCase().includes(query.value.toLowerCase())),
)

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

        <ul>
            <ProductCard
                v-for="product in filtered"
                :key="product.id"
                :product="product"
                :badge="{ text: 'new' }"
                @raise="raisePrice(product.id)"
            />
        </ul>

        <StaticNote />
    </main>
</template>
