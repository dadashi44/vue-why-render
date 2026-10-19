<script setup lang="ts">
import { useCart } from '../stores/cart'

const cart = useCart()
</script>

<template>
    <p>
        В корзине: {{ cart.items.length }} на {{ cart.total }} ₽
        <button @click="cart.clear()">
            очистить
        </button>
    </p>
</template>
