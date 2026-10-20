<script setup lang="ts">
/**
 * Иконки тулбара — своими SVG, а не символами Юникода: глифы вроде «⤓»
 * в моноширинных шрифтах разных систем рисуются по-разному или не рисуются
 * вовсе. Цвет — currentColor, так что тема панели действует и на них.
 */
export type IconName = 'record' | 'pause' | 'reset' | 'download' | 'open'

defineProps<{ name: IconName }>()
</script>

<template>
    <svg
        class="vwr__icon"
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
    >
        <circle v-if="name === 'record'" cx="8" cy="8" r="4" fill="currentColor" stroke="none" />
        <template v-else-if="name === 'pause'">
            <rect x="4" y="3.5" width="2.6" height="9" rx="0.6" fill="currentColor" stroke="none" />
            <rect x="9.4" y="3.5" width="2.6" height="9" rx="0.6" fill="currentColor" stroke="none" />
        </template>
        <template v-else-if="name === 'reset'">
            <path d="M3.5 8a4.5 4.5 0 1 0 1.32-3.18" />
            <path d="M3.6 2.6v2.6h2.6" />
        </template>
        <template v-else-if="name === 'download'">
            <path d="M8 2.5v8" />
            <path d="M4.5 7 8 10.5 11.5 7" />
            <path d="M3 13.5h10" />
        </template>
        <template v-else>
            <path d="M8 13.5v-8" />
            <path d="M4.5 9 8 5.5 11.5 9" />
            <path d="M3 2.5h10" />
        </template>
    </svg>
</template>
