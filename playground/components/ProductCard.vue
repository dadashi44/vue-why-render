<script setup lang="ts">
defineProps<{
    product: { id: number, title: string, price: number }
    /** Специально литерал в шаблоне родителя — панель пометит это как новую ссылку. */
    badge: { text: string }
}>()

defineEmits<{ raise: [] }>()
</script>

<template>
    <li>
        {{ product.title }} — {{ product.price }} ₽ ({{ badge.text }})
        <button @click="$emit('raise')">
            +100
        </button>
    </li>
</template>
