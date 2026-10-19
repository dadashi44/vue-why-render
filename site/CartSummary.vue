<script setup lang="ts">
import { useCart } from './stores/cart'

// Подписи снаружи: сайт переключает языки, а компонент — часть демо и
// должен попадать в панель под своим именем.
defineProps<{ label: string, clearLabel: string, currency: string }>()

const cart = useCart()
</script>

<template>
    <div class="demo__row demo__cart">
        <span>{{ label }} {{ cart.items.length }} · {{ cart.total }} {{ currency }}</span>
        <button type="button" @click="cart.clear()">
            {{ clearLabel }}
        </button>
    </div>
</template>
