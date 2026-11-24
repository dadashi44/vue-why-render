<script setup lang="ts">
import type { SiteMessages } from '../i18n'

defineProps<{ t: SiteMessages }>()

// Строки примеров — то, что печатает панель; не переводятся.
const rows = [
    { kind: 'prop', component: 'ProductCard', detail: 'price: 1290 → 1190' },
    { kind: 'ref', component: 'SearchBar', detail: 'query: "lam" → "lamp"' },
    { kind: 'computed', component: 'Clock', detail: 'time' },
    { kind: 'pinia', component: 'CartBadge', detail: 'cart.items.length: 2 → 3' },
    { kind: 'router', component: 'ProductPage', detail: 'params.id: /p/12 → /p/13' },
]
</script>

<template>
    <section class="site-section site-causes" aria-labelledby="causes-heading">
        <div class="site-causes__intro">
            <h2 id="causes-heading" class="site-h2">
                {{ t.causesHeading }}
            </h2>
            <p class="site-sub">
                {{ t.causesLead }}
            </p>
        </div>

        <ul class="causes">
            <li v-for="row in rows" :key="row.kind" class="causes__row">
                <span class="causes__kind">{{ row.kind }}</span>
                <span class="causes__text"><b>{{ row.component }}</b> {{ row.detail }}</span>
            </li>
        </ul>
    </section>
</template>
