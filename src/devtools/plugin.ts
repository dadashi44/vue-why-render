import type { App } from 'vue'
import type { Scanner } from '../core/scanner'
import type { ComponentRecord, RenderEvent } from '../types'
import { getMessages } from '../i18n'
import { hintsForRecord } from '../core/hints'
import { averageDuration, formatDuration, formatHint, formatPropChange, formatReason } from '../panel/format'
import type { CustomInspectorNode, DevtoolsPluginApi, InspectorNodeTag } from './types'
import { setupDevtoolsPlugin } from './types'

export const INSPECTOR_ID = 'vue-why-render'
export const DEPS_INSPECTOR_ID = 'vue-why-render-deps'
export const TIMELINE_ID = 'vue-why-render'
export const TIMELINE_DEPS_ID = 'vue-why-render-deps'

/** Зелёный акцент пакета. DevTools ждёт цвет числом, а не строкой. */
const COLOR = 0x6EE7A8
const COLOR_HOT = 0xEF4444
const COLOR_TEXT = 0x000000
const COLOR_DEPS = 0x7AA2F7

const SOURCE_COLORS: Record<string, number> = {
    props: 0x7AA2F7,
    setup: 0xBB9AF7,
    store: 0xF0B86E,
    computed: 0x6EE7A8,
    route: 0xE06C75,
    data: 0x56B6C2,
    array: 0xD19A66,
    collection: 0xC678DD,
    unknown: 0x5C6370,
}

/** Метка «×7» на узле: сколько раз компонент перерисовался. */
function countTag(record: ComponentRecord, hotThreshold: number): InspectorNodeTag {
    const hot = record.renderCount >= hotThreshold
    return {
        label: `×${record.renderCount}`,
        textColor: COLOR_TEXT,
        backgroundColor: hot ? COLOR_HOT : COLOR,
        tooltip: hot ? 'Re-renders often' : 'Re-renders',
    }
}

function buildTree(scanner: Scanner, filter: string): CustomInspectorNode[] {
    const query = filter.trim().toLowerCase()

    return scanner.registry
        .top(200)
        .filter(record => !query
            || record.name.toLowerCase().includes(query)
            || (record.file?.toLowerCase().includes(query) ?? false))
        .map(record => ({
            id: String(record.uid),
            label: record.name,
            tags: [countTag(record, scanner.options.hotThreshold)],
        }))
}

function buildState(scanner: Scanner, nodeId: string) {
    const record = scanner.registry.get(Number(nodeId))
    if (!record) return {}

    const t = getMessages(scanner.options.locale)

    const summary = [
        { key: 'renders', value: record.renderCount },
        { key: 'updates', value: record.updateCount },
        { key: 'average', value: formatDuration(averageDuration(record)) },
        { key: 'slowest', value: formatDuration(record.maxDuration) },
        { key: 'file', value: record.file ?? '—' },
    ]

    const state: Record<string, Array<{ key: string, value: unknown }>> = { summary }

    const reasons = record.lastReasons.map((reason, index) => ({
        key: String(index),
        value: formatReason(reason, t),
    }))
    if (reasons.length) state['last render'] = reasons

    const props = record.lastPropChanges.map(change => ({
        key: change.key,
        value: formatPropChange(change, t),
    }))
    if (props.length) state['prop changes'] = props

    const hints = hintsForRecord(record, scanner.options).map((hint, index) => ({
        key: String(index),
        value: formatHint(hint, t),
    }))
    if (hints.length) state.hints = hints

    const deps = scanner.depsGraph.depsOf(record.uid)
    if (deps.length) {
        state.dependencies = deps
            .sort((a, b) => b.triggers - a.triggers || b.reads - a.reads)
            .map(edge => ({
                key: `${edge.dep.source}:${edge.dep.label}`,
                value: `${edge.reads} reads, ${edge.triggers} triggers`,
            }))
    }

    return state
}

function buildDepsTree(scanner: Scanner, filter: string): CustomInspectorNode[] {
    const query = filter.trim().toLowerCase()
    const snapshot = scanner.depsGraph.snapshot()

    return snapshot.nodes
        .map(node => {
            const edges = snapshot.edges.filter(e => e.dep.id === node.id)
            return { node, edges, totalTriggers: edges.reduce((s, e) => s + e.triggers, 0) }
        })
        .filter(d => d.edges.length > 0)
        .filter(d => !query || d.node.label.toLowerCase().includes(query))
        .sort((a, b) => b.totalTriggers - a.totalTriggers || b.edges.length - a.edges.length)
        .map(d => ({
            id: d.node.id,
            label: d.node.label,
            tags: [
                {
                    label: d.node.source,
                    textColor: COLOR_TEXT,
                    backgroundColor: SOURCE_COLORS[d.node.source] ?? SOURCE_COLORS.unknown,
                    tooltip: `Source type: ${d.node.source}`,
                },
                {
                    label: `${d.edges.length} comp`,
                    textColor: COLOR_TEXT,
                    backgroundColor: COLOR,
                    tooltip: `Used by ${d.edges.length} components`,
                },
                ...(d.totalTriggers > 0 ? [{
                    label: `${d.totalTriggers}t`,
                    textColor: COLOR_TEXT,
                    backgroundColor: COLOR_HOT,
                    tooltip: `${d.totalTriggers} re-render triggers`,
                }] : []),
            ],
        }))
}

function buildDepsState(scanner: Scanner, nodeId: string) {
    const dependents = scanner.depsGraph.dependents(nodeId)
    if (!dependents.length) return {}

    const snapshot = scanner.depsGraph.snapshot()
    const node = snapshot.nodes.find(n => n.id === nodeId)

    const state: Record<string, Array<{ key: string, value: unknown }>> = {}

    if (node) {
        state.source = [
            { key: 'type', value: node.source },
            { key: 'key', value: node.label },
            ...(node.store ? [{ key: 'store', value: node.store }] : []),
        ]
    }

    state.dependents = dependents.map(d => ({
        key: d.name,
        value: `${d.reads} reads, ${d.triggers} triggers`,
    }))

    return state
}

/** Событие рендера в строку для таймлайна. */
function describeEvent(event: RenderEvent, scanner: Scanner): string {
    const t = getMessages(scanner.options.locale)
    const first = event.propChanges[0]
    if (first) return formatPropChange(first, t)
    const reason = event.reasons[0]
    return reason ? formatReason(reason, t) : event.phase
}

/**
 * Регистрирует инспектор и слой таймлайна в Vue DevTools.
 *
 * Собственную панель это не заменяет: расширение стоит не у всех и не везде
 * ставится — в закрытом контуре, в чужом браузере на демо, в вебвью. Панель
 * работает там, где DevTools нет, а DevTools удобнее там, где он есть.
 */
export function setupDevtools(app: App, scanner: Scanner): () => void {
    let unsubscribe: (() => void) | null = null
    let unsubscribeEvents: (() => void) | null = null
    let unsubscribeDeps: (() => void) | null = null
    let stopped = false

    setupDevtoolsPlugin({
        id: 'vue-why-render',
        label: 'Why render',
        app,
        packageName: 'vue-why-render',
        homepage: 'https://github.com/dadashi44/vue-why-render',
    }, (api: DevtoolsPluginApi) => {
        if (stopped) return

        api.addInspector({
            id: INSPECTOR_ID,
            label: 'Why render',
            treeFilterPlaceholder: 'filter by name or file',
        })

        api.addInspector({
            id: DEPS_INSPECTOR_ID,
            label: 'Dependencies',
            icon: 'account_tree',
            treeFilterPlaceholder: 'filter by source name',
        })

        api.addTimelineLayer({
            id: TIMELINE_ID,
            label: 'Why render',
            color: COLOR,
        })

        api.addTimelineLayer({
            id: TIMELINE_DEPS_ID,
            label: 'Deps triggers',
            color: COLOR_DEPS,
        })

        api.on.getInspectorTree((payload) => {
            if (payload.inspectorId === INSPECTOR_ID) {
                payload.rootNodes = buildTree(scanner, payload.filter)
            } else if (payload.inspectorId === DEPS_INSPECTOR_ID) {
                payload.rootNodes = buildDepsTree(scanner, payload.filter)
            }
        })

        api.on.getInspectorState((payload) => {
            if (payload.inspectorId === INSPECTOR_ID) {
                payload.state = buildState(scanner, payload.nodeId)
            } else if (payload.inspectorId === DEPS_INSPECTOR_ID) {
                payload.state = buildDepsState(scanner, payload.nodeId)
            }
        })

        unsubscribe = scanner.registry.subscribe(() => {
            api.sendInspectorTree(INSPECTOR_ID)
            api.sendInspectorState(INSPECTOR_ID)
        })

        unsubscribeDeps = scanner.depsGraph.subscribe(() => {
            api.sendInspectorTree(DEPS_INSPECTOR_ID)
            api.sendInspectorState(DEPS_INSPECTOR_ID)
        })

        unsubscribeEvents = scanner.registry.onEvent((event) => {
            const now = api.now ? api.now() : Date.now()
            const t = getMessages(scanner.options.locale)

            api.addTimelineEvent({
                layerId: TIMELINE_ID,
                event: {
                    time: now,
                    title: event.name,
                    subtitle: describeEvent(event, scanner),
                    groupId: event.uid,
                    data: {
                        component: event.name,
                        file: event.file ?? '—',
                        phase: event.phase,
                        duration: formatDuration(event.duration),
                        fps: event.fps,
                        reasons: event.reasons.map(reason => formatReason(reason, t)),
                        propChanges: event.propChanges.map(change => formatPropChange(change, t)),
                    },
                },
            })

            for (const reason of event.reasons) {
                api.addTimelineEvent({
                    layerId: TIMELINE_DEPS_ID,
                    event: {
                        time: now,
                        title: `${reason.source}:${reason.key}`,
                        subtitle: `triggered ${event.name}`,
                        groupId: `dep:${reason.source}:${reason.key}`,
                        data: {
                            source: reason.source,
                            key: reason.key,
                            component: event.name,
                            ...(reason.store ? { store: reason.store } : {}),
                        },
                    },
                })
            }
        })
    })

    return () => {
        stopped = true
        unsubscribe?.()
        unsubscribeEvents?.()
        unsubscribeDeps?.()
    }
}
