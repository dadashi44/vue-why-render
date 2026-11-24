<script setup lang="ts">
import type { SiteMessages } from '../i18n'

defineProps<{ t: SiteMessages }>()
</script>

<template>
    <section class="site-section site-agents" aria-labelledby="agents-heading">
        <div class="site-agents__text">
            <h2 id="agents-heading" class="site-h2">
                {{ t.agentsHeading }}
            </h2>
            <p class="site-sub">
                {{ t.agentsLead }}
            </p>
            <a class="site-agents__link" :href="t.docsHref + 'guides/mcp/'">{{ t.agentsLink }}</a>
        </div>

        <!-- Пример диалога с агентом: язык вопроса не переводится, это вывод инструмента. -->
        <pre class="site-agents__dialog">&gt; why does CartBadge render on every keystroke?

<span class="site-agents__dim">report: CartBadge ×48, cause: store
  cart.items (whole array replaced in addItem)</span>

Use cart.items.push() instead of a new array.</pre>
    </section>
</template>
