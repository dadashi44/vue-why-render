<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import type { Scanner } from '../core/scanner'
import { getMessages } from '../i18n'
import type { TreeNode } from '../core/registry'
import type { ComponentRecord } from '../types'
import { throttle } from '../utils/throttle'
import {
    averageDuration,
    buildEditorUrl,
    formatDuration,
    formatPropChange,
    formatReason,
    matchesQuery,
    shortFile,
    whyLines,
} from './format'

const props = defineProps<{ scanner: Scanner }>()

type Tab = 'top' | 'slow' | 'tree' | 'events'

// Локаль задаётся один раз при подключении и не меняется на лету,
// поэтому словарь берём сразу, без реактивной обёртки.
const t = getMessages(props.scanner.options.locale)

const collapsed = ref(false)
const tab = ref<Tab>('top')
const query = ref('')
const paused = ref(false)
const snapshot = shallowRef(props.scanner.registry.snapshot())
const tree = shallowRef<TreeNode[]>([])

let unsubscribe: (() => void) | null = null

const refresh = throttle(() => {
    snapshot.value = props.scanner.registry.snapshot()
    if (tab.value === 'tree') tree.value = props.scanner.registry.tree()
}, props.scanner.options.flushInterval)

onMounted(() => {
    unsubscribe = props.scanner.registry.subscribe(refresh)
    refresh()
})

onBeforeUnmount(() => {
    refresh.cancel()
    unsubscribe?.()
})

// Реестр намеренно нереактивный, поэтому реактивную зависимость даёт snapshot:
// без обращения к нему список пересчитается только при смене фильтра.
const topRecords = computed<ComponentRecord[]>(() => {
    void snapshot.value
    return props.scanner.registry.top(50).filter(record => matchesQuery(record, query.value))
})

const slowRecords = computed<ComponentRecord[]>(() => {
    void snapshot.value
    return props.scanner.registry.slowest(50).filter(record => matchesQuery(record, query.value))
})

const flatTree = computed<TreeNode[]>(() => {
    void snapshot.value
    const out: TreeNode[] = []
    const walk = (nodes: TreeNode[]): void => {
        for (const node of [...nodes].sort((a, b) => b.subtreeRenders - a.subtreeRenders)) {
            if (matchesQuery(node, query.value) || node.children.length > 0) out.push(node)
            walk(node.children)
        }
    }
    walk(tree.value)
    return out
})

const events = computed(() => [...snapshot.value.events].reverse().slice(0, 100))

const summary = computed(() => {
    const seconds = Math.max(1, (Date.now() - snapshot.value.startedAt) / 1000)
    return {
        renders: snapshot.value.totalRenders,
        components: snapshot.value.totalComponents,
        perSecond: (snapshot.value.totalRenders / seconds).toFixed(1),
    }
})

function selectTab(next: Tab): void {
    tab.value = next
    if (next === 'tree') tree.value = props.scanner.registry.tree()
}

function togglePause(): void {
    paused.value = !paused.value
    props.scanner.registry.setPaused(paused.value)
}

function reset(): void {
    props.scanner.registry.reset()
    tree.value = props.scanner.registry.tree()
    refresh.flush()
}

function openInEditor(record: ComponentRecord): void {
    if (!record.file) return
    const url = buildEditorUrl(props.scanner.options.openInEditorUrl, record.file)
    // Дев-сервер отдаёт 204 и открывает IDE — ответ нам не нужен.
    fetch(url).catch(() => {})
}

</script>

<template>
    <div class="vwr" :class="{ 'vwr--collapsed': collapsed }">
        <div class="vwr__head" @click="collapsed = !collapsed">
            <span class="vwr__title">why-render</span>
            <span class="vwr__badge">{{ summary.renders }}</span>
            <span class="vwr__spacer" />
            <span class="vwr__stat">{{ summary.perSecond }}/s · {{ summary.components }} {{ t.components }}</span>
            <span class="vwr__stat">{{ collapsed ? '▲' : '▼' }}</span>
        </div>

        <div v-if="!collapsed" class="vwr__body">
            <div class="vwr__tabs">
                <button
                    class="vwr__tab"
                    :class="{ 'vwr__tab--active': tab === 'top' }"
                    @click="selectTab('top')"
                >
                    {{ t.tabTop }}
                </button>
                <button
                    class="vwr__tab"
                    :class="{ 'vwr__tab--active': tab === 'slow' }"
                    @click="selectTab('slow')"
                >
                    {{ t.tabSlow }}
                </button>
                <button
                    class="vwr__tab"
                    :class="{ 'vwr__tab--active': tab === 'tree' }"
                    @click="selectTab('tree')"
                >
                    {{ t.tabTree }}
                </button>
                <button
                    class="vwr__tab"
                    :class="{ 'vwr__tab--active': tab === 'events' }"
                    @click="selectTab('events')"
                >
                    {{ t.tabEvents }}
                </button>
            </div>

            <div class="vwr__toolbar">
                <input v-model="query" class="vwr__search" type="search" :placeholder="t.searchPlaceholder">
                <button class="vwr__btn" :class="{ 'vwr__btn--on': paused }" @click="togglePause()">
                    {{ paused ? t.paused : t.recording }}
                </button>
                <button class="vwr__btn" @click="reset()">
                    {{ t.reset }}
                </button>
            </div>

            <ul v-if="tab === 'top' || tab === 'slow'" class="vwr__list">
                <li v-if="(tab === 'top' ? topRecords : slowRecords).length === 0" class="vwr__empty">
                    {{ t.emptyRenders }}
                </li>
                <li v-for="record in tab === 'top' ? topRecords : slowRecords" :key="record.uid">
                    <button class="vwr__row" :title="record.file" @click="openInEditor(record)">
                        <span class="vwr__name">
                            {{ record.name }}
                            <span class="vwr__dim">{{ shortFile(record.file) }}</span>
                        </span>
                        <span class="vwr__count">×{{ record.renderCount }}</span>
                        <span class="vwr__time">{{ formatDuration(averageDuration(record)) }}</span>
                    </button>
                    <span
                        v-for="(line, index) in whyLines(record, t)"
                        :key="index"
                        class="vwr__why"
                    >{{ line }}</span>
                </li>
            </ul>

            <ul v-else-if="tab === 'tree'" class="vwr__list">
                <li v-if="flatTree.length === 0" class="vwr__empty">
                    {{ t.emptyTree }}
                </li>
                <li v-for="node in flatTree" :key="node.uid">
                    <button class="vwr__row" :title="node.file" @click="openInEditor(node)">
                        <span class="vwr__name">
                            <span class="vwr__tree-indent">{{ '│ '.repeat(node.depth) }}</span>
                            {{ node.name }}
                        </span>
                        <span class="vwr__count">×{{ node.renderCount }}</span>
                        <span class="vwr__time">Σ{{ node.subtreeRenders }}</span>
                    </button>
                </li>
            </ul>

            <ul v-else class="vwr__list">
                <li v-if="events.length === 0" class="vwr__empty">
                    {{ t.emptyEvents }}
                </li>
                <li v-for="(event, index) in events" :key="`${event.uid}-${event.timestamp}-${index}`" class="vwr__event">
                    <div class="vwr__event-head">
                        <span class="vwr__name">{{ event.name }}</span>
                        <span class="vwr__dim">{{ event.phase }}</span>
                        <span class="vwr__time">{{ formatDuration(event.duration) }}</span>
                    </div>
                    <span v-for="(reason, reasonIndex) in event.reasons" :key="reasonIndex" class="vwr__why">
                        {{ formatReason(reason, t) }}
                    </span>
                    <span
                        v-for="(change, changeIndex) in event.propChanges"
                        :key="`p${changeIndex}`"
                        class="vwr__why vwr__why--prop"
                    >{{ formatPropChange(change, t) }}</span>
                </li>
            </ul>
        </div>
    </div>
</template>
