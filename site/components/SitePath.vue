<script setup lang="ts">
import type { SiteMessages } from '../i18n'

const props = defineProps<{ t: SiteMessages }>()

// В тексте шага код стоит прямо в прозе; выделяем его в <code>.
const codePattern = /(expectRenders\(\w+\)\.toBe\(\d+\))/

const steps = props.t.path.map(step => ({
    title: step.title,
    parts: step.text.split(codePattern).map((text, index) => ({ text, code: index % 2 === 1 })).filter(part => part.text),
}))
</script>

<template>
    <section class="site-section site-path" aria-labelledby="path-heading">
        <h2 id="path-heading" class="site-h2">
            {{ t.pathHeading }}
        </h2>

        <ol class="path">
            <li v-for="(step, index) in steps" :key="index" class="path__step" :class="{ 'path__step--first': index === 0 }">
                <span class="path__num">{{ index + 1 }}</span>
                <h3 class="path__title">
                    {{ step.title }}
                </h3>
                <p class="path__text">
                    <template v-for="(part, i) in step.parts" :key="i">
                        <code v-if="part.code">{{ part.text }}</code>
                        <template v-else>{{ part.text }}</template>
                    </template>
                </p>
            </li>
        </ol>
    </section>
</template>
