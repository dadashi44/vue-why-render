<script setup lang="ts">
withDefaults(defineProps<{
    product: { id: number, title: string, price: number }
    /** Специально литерал в шаблоне родителя — панель пометит это как новую ссылку. */
    badge: { text: string }
    /** Валюта задаётся снаружи: сайт переключает языки, песочница — нет. */
    currency?: string
}>(), { currency: '₽' })

defineEmits<{ raise: [] }>()
</script>

<template>
    <li>
        {{ product.title }} — {{ product.price }} {{ currency }} ({{ badge.text }})
        <button @click="$emit('raise')">
            +100
        </button>
    </li>
</template>
