<script setup lang="ts">
defineProps<{ count: number }>()
</script>

<template>
    <p id="count">
        {{ count }}
    </p>
</template>
