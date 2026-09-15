<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const time = ref(new Date().toLocaleTimeString())
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
    timer = setInterval(() => {
        time.value = new Date().toLocaleTimeString()
    }, 1000)
})

onBeforeUnmount(() => {
    if (timer) clearInterval(timer)
})
</script>

<template>
    <span>{{ time }}</span>
</template>
