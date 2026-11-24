<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SiteMessages } from '../i18n'
import { bigplayRows, isHot, MAX_TICKS, ticks } from '../timeline'
import type { Scenario } from '../timeline'

defineProps<{ t: SiteMessages }>()

const after = ref(false)

const total = computed(() => bigplayRows.reduce((sum, row) => sum + (after.value ? row.after : row.before), 0))

// Отметки рисуем всегда по числу «до»; в состоянии «после» остаются
// равномерно распределённые `after` штук, остальные гаснут.
const rows = computed(() => bigplayRows.map((row) => {
    const count = after.value ? row.after : row.before
    const shown = Math.min(row.before, MAX_TICKS)
    return {
        ...row,
        count,
        hot: isHot(count),
        ticks: ticks(row.before).map((left, i) => ({
            left,
            on: after.value
                ? Math.floor(((i + 1) * Math.min(row.after, shown)) / shown) > Math.floor((i * Math.min(row.after, shown)) / shown)
                : true,
        })),
    }
}))

const groups = computed(() => [
    { scenario: 'home' as Scenario, label: 'scenarioHome' as const },
    { scenario: 'query' as Scenario, label: 'scenarioQuery' as const },
].map(group => ({ ...group, rows: rows.value.filter(row => row.scenario === group.scenario) })))
</script>

<template>
    <section class="site-section site-timeline" aria-labelledby="timeline-heading">
        <h2 id="timeline-heading" class="site-h2">
            {{ t.timelineHeading }}
        </h2>
        <p class="site-sub">
            {{ t.timelineLead }}
        </p>

        <div class="timeline">
            <div class="timeline__bar">
                <div class="timeline__switch" role="group" :aria-label="t.timelineHeading">
                    <button type="button" :aria-pressed="!after" @click="after = false">
                        {{ t.before }}
                    </button>
                    <button type="button" :aria-pressed="after" @click="after = true">
                        {{ t.after }}
                    </button>
                </div>
                <p class="timeline__total" :class="{ 'timeline__total--ok': after }">
                    <span>{{ t.rendersLabel }}</span> <b>{{ total }}</b>
                </p>
            </div>

            <div v-for="group in groups" :key="group.scenario" class="timeline__group">
                <h3 class="timeline__scenario">
                    {{ t[group.label] }}
                </h3>
                <div v-for="row in group.rows" :key="row.name" class="timeline__row">
                    <span class="timeline__name">{{ row.name }}</span>
                    <div class="timeline__lane">
                        <span
                            v-for="(tick, i) in row.ticks"
                            :key="i"
                            class="timeline__tick"
                            :class="{ 'timeline__tick--on': tick.on, 'timeline__tick--hot': row.hot }"
                            :style="{ left: `${tick.left}%` }"
                        />
                        <span class="wr-play" />
                    </div>
                    <span class="timeline__count" :class="{ 'timeline__count--hot': row.hot }">×{{ row.count }}</span>
                </div>
            </div>

            <p class="timeline__note">
                {{ after ? t.noteAfter : t.noteBefore }}
            </p>
        </div>

        <a class="timeline__case" href="cases/bigplay/">{{ t.readCase }}</a>
    </section>
</template>
