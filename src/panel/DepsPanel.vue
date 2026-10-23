<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import type { DepsGraph, DepsSnapshot, DepEdge } from '../core/deps-graph'
import type { Locale } from '../i18n'

const props = defineProps<{
    graph: DepsGraph
    locale: Locale
}>()

const data = shallowRef<DepsSnapshot>(props.graph.snapshot())
const selected = ref<{ type: 'component', uid: number } | { type: 'dep', id: string } | null>(null)
const query = ref('')

let unsubscribe: (() => void) | null = null

onMounted(() => {
    unsubscribe = props.graph.subscribe(() => {
        data.value = props.graph.snapshot()
    })
})

onBeforeUnmount(() => {
    unsubscribe?.()
})

const sourceColors: Record<string, string> = {
    props: 'var(--vwr-dep-props)',
    setup: 'var(--vwr-dep-setup)',
    store: 'var(--vwr-dep-store)',
    computed: 'var(--vwr-dep-computed)',
    route: 'var(--vwr-dep-route)',
    data: 'var(--vwr-dep-data)',
    array: 'var(--vwr-dep-array)',
    collection: 'var(--vwr-dep-collection)',
    unknown: 'var(--vwr-dep-unknown)',
}

function depColor(source: string): string {
    return sourceColors[source] || sourceColors.unknown
}

interface ComponentRow {
    uid: number
    name: string
    file?: string
    deps: DepEdge[]
    totalReads: number
    totalTriggers: number
}

const components = computed<ComponentRow[]>(() => {
    const snap = data.value
    const matchLower = query.value.toLowerCase()

    return snap.components
        .map(c => {
            const deps = snap.edges.filter(e => e.componentUid === c.uid)
            return {
                ...c,
                deps,
                totalReads: deps.reduce((s, e) => s + e.reads, 0),
                totalTriggers: deps.reduce((s, e) => s + e.triggers, 0),
            }
        })
        .filter(c => c.deps.length > 0)
        .filter(c => !matchLower || c.name.toLowerCase().includes(matchLower))
        .sort((a, b) => b.totalTriggers - a.totalTriggers || b.deps.length - a.deps.length)
})

interface DepRow {
    id: string
    label: string
    source: string
    store?: string
    dependents: number
    totalTriggers: number
}

const depSources = computed<DepRow[]>(() => {
    const snap = data.value
    const matchLower = query.value.toLowerCase()

    return snap.nodes
        .map(n => {
            const edges = snap.edges.filter(e => e.dep.id === n.id)
            return {
                ...n,
                dependents: edges.length,
                totalTriggers: edges.reduce((s, e) => s + e.triggers, 0),
            }
        })
        .filter(d => d.dependents > 0)
        .filter(d => !matchLower || d.label.toLowerCase().includes(matchLower))
        .sort((a, b) => b.totalTriggers - a.totalTriggers || b.dependents - a.dependents)
})

const detail = computed(() => {
    if (!selected.value) return null

    if (selected.value.type === 'component') {
        const uid = selected.value.uid
        const comp = data.value.components.find(c => c.uid === uid)
        if (!comp) return null
        const deps = data.value.edges.filter(e => e.componentUid === uid)
            .sort((a, b) => b.triggers - a.triggers || b.reads - a.reads)
        return { kind: 'component' as const, name: comp.name, file: comp.file, deps }
    }

    const depId = selected.value.id
    const node = data.value.nodes.find(n => n.id === depId)
    if (!node) return null
    const dependents = props.graph.dependents(depId)
    return { kind: 'dep' as const, node, dependents }
})

const viewMode = ref<'components' | 'sources'>('components')

function selectComponent(uid: number): void {
    selected.value = selected.value?.type === 'component' && selected.value.uid === uid
        ? null
        : { type: 'component', uid }
}

function selectDep(id: string): void {
    selected.value = selected.value?.type === 'dep' && selected.value.id === id
        ? null
        : { type: 'dep', id }
}

function sourceLabel(source: string): string {
    const labels: Record<string, string> = {
        props: 'prop',
        setup: 'ref',
        store: 'store',
        computed: 'computed',
        route: 'route',
        data: 'data',
        array: 'array',
        collection: 'collection',
        unknown: '?',
    }
    return labels[source] || source
}
</script>

<template>
    <div class="vwr-deps">
        <div class="vwr-deps__modes">
            <button
                class="vwr__tab"
                :class="{ 'vwr__tab--active': viewMode === 'components' }"
                @click="viewMode = 'components'; selected = null"
            >
                Components
            </button>
            <button
                class="vwr__tab"
                :class="{ 'vwr__tab--active': viewMode === 'sources' }"
                @click="viewMode = 'sources'; selected = null"
            >
                Sources
            </button>
            <input v-model="query" class="vwr__search vwr-deps__search" type="search" placeholder="filter...">
        </div>

        <div class="vwr-deps__content">
            <!-- Component list -->
            <ul v-if="viewMode === 'components'" class="vwr__list vwr-deps__list">
                <li v-if="components.length === 0" class="vwr__empty">
                    No dependencies tracked yet. Interact with the app.
                </li>
                <li
                    v-for="comp in components"
                    :key="comp.uid"
                    class="vwr-deps__item"
                    :class="{ 'vwr-deps__item--selected': selected?.type === 'component' && selected.uid === comp.uid }"
                    @click="selectComponent(comp.uid)"
                >
                    <div class="vwr__line">
                        <span class="vwr__name">{{ comp.name }}</span>
                        <span class="vwr__dim">{{ comp.deps.length }} deps</span>
                        <span v-if="comp.totalTriggers" class="vwr-deps__triggers">{{ comp.totalTriggers }} triggers</span>
                    </div>
                </li>
            </ul>

            <!-- Source list -->
            <ul v-else class="vwr__list vwr-deps__list">
                <li v-if="depSources.length === 0" class="vwr__empty">
                    No dependencies tracked yet. Interact with the app.
                </li>
                <li
                    v-for="dep in depSources"
                    :key="dep.id"
                    class="vwr-deps__item"
                    :class="{ 'vwr-deps__item--selected': selected?.type === 'dep' && selected.id === dep.id }"
                    @click="selectDep(dep.id)"
                >
                    <div class="vwr__line">
                        <span class="vwr-deps__badge" :style="{ background: depColor(dep.source) }">{{ sourceLabel(dep.source) }}</span>
                        <span class="vwr__name">{{ dep.label }}</span>
                        <span class="vwr__dim">{{ dep.dependents }} components</span>
                        <span v-if="dep.totalTriggers" class="vwr-deps__triggers">{{ dep.totalTriggers }} triggers</span>
                    </div>
                </li>
            </ul>

            <!-- Detail panel -->
            <div v-if="detail" class="vwr-deps__detail">
                <template v-if="detail.kind === 'component'">
                    <div class="vwr-deps__detail-head">
                        <strong>{{ detail.name }}</strong>
                        <span v-if="detail.file" class="vwr__dim">{{ detail.file }}</span>
                    </div>
                    <div class="vwr-deps__detail-sub">Dependencies ({{ detail.deps.length }}):</div>
                    <ul class="vwr-deps__detail-list">
                        <li v-for="edge in detail.deps" :key="edge.dep.id" class="vwr-deps__detail-row">
                            <span class="vwr-deps__badge" :style="{ background: depColor(edge.dep.source) }">{{ sourceLabel(edge.dep.source) }}</span>
                            <span class="vwr-deps__detail-label">{{ edge.dep.label }}</span>
                            <span class="vwr__dim">{{ edge.reads }}r</span>
                            <span v-if="edge.triggers" class="vwr-deps__triggers">{{ edge.triggers }}t</span>
                        </li>
                    </ul>
                </template>

                <template v-else>
                    <div class="vwr-deps__detail-head">
                        <span class="vwr-deps__badge" :style="{ background: depColor(detail.node.source) }">{{ sourceLabel(detail.node.source) }}</span>
                        <strong>{{ detail.node.label }}</strong>
                    </div>
                    <div class="vwr-deps__detail-sub">Dependents ({{ detail.dependents.length }}):</div>
                    <ul class="vwr-deps__detail-list">
                        <li v-for="dep in detail.dependents" :key="dep.uid" class="vwr-deps__detail-row">
                            <span class="vwr__name">{{ dep.name }}</span>
                            <span class="vwr__dim">{{ dep.reads }}r</span>
                            <span v-if="dep.triggers" class="vwr-deps__triggers">{{ dep.triggers }}t</span>
                        </li>
                    </ul>
                </template>
            </div>
        </div>
    </div>
</template>
