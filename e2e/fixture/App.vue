<script setup lang="ts">
import { ref } from 'vue'
import { useCart } from './store'
import Counter from './Counter.vue'

const cart = useCart()
const count = ref(0)
</script>

<template>
    <main>
        <Counter :count="count" />
        <button id="bump" @click="count++">
            bump
        </button>
        <p id="cart">
            {{ cart.items.length }}
        </p>
        <button id="add" @click="cart.add('mouse')">
            add
        </button>
    </main>
</template>
