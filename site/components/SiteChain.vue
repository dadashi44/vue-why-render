<script setup lang="ts">
import type { SiteMessages } from '../i18n'

const props = defineProps<{ t: SiteMessages }>()

// Имена и значения — код, не переводятся; подписи узлов берём из словаря.
const nodes = [
    { name: 'cart.add(lamp)', detail: 'stores/cart.ts:41' },
    { name: 'cart.items', detail: 'length 2 → 3' },
    { name: 'subtotal', detail: '2 580 → 3 770' },
    { name: '<CartBadge>', detail: '0.4 ms, 3rd time', last: true },
].map((node, index) => ({ ...node, label: props.t.chainLabels[index], delay: `${index * 0.9}s` }))
</script>

<template>
    <section class="site-section site-chain" aria-labelledby="chain-heading">
        <h2 id="chain-heading" class="site-h2">
            {{ t.chainHeading }}
        </h2>
        <p class="site-sub">
            {{ t.chainLead }}
        </p>

        <ol class="chain" :aria-label="t.chainHeading">
            <template v-for="(node, index) in nodes" :key="node.name">
                <li class="chain__node wr-node" :style="{ '--wr-delay': node.delay }">
                    <span class="chain__label">{{ node.label }}</span>
                    <b class="chain__name" :class="{ 'chain__name--last': node.last }">{{ node.name }}</b>
                    <span class="chain__detail">{{ node.detail }}</span>
                </li>
                <li v-if="index < nodes.length - 1" class="chain__wire wr-wire" aria-hidden="true" :style="{ '--wr-delay': `${0.3 + index * 0.9}s` }" />
            </template>
        </ol>
    </section>
</template>
