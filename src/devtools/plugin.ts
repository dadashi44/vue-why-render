import type { App } from 'vue'
import type { Scanner } from '../core/scanner'
import type { ComponentRecord, RenderEvent } from '../types'
import { getMessages } from '../i18n'
import { hintsForRecord } from '../core/hints'
import { averageDuration, formatDuration, formatHint, formatPropChange, formatReason } from '../panel/format'
import type { CustomInspectorNode, DevtoolsPluginApi, InspectorNodeTag } from './types'
import { setupDevtoolsPlugin } from './types'

export const INSPECTOR_ID = 'vue-why-render'
export const TIMELINE_ID = 'vue-why-render'

/** Зелёный акцент пакета. DevTools ждёт цвет числом, а не строкой. */
const COLOR = 0x6EE7A8
const COLOR_HOT = 0xEF4444
const COLOR_TEXT = 0x000000

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
    let stopped = false

    setupDevtoolsPlugin({
        id: 'vue-why-render',
        label: 'Why render',
        app,
        packageName: 'vue-why-render',
        homepage: 'https://github.com/dadashi44/vue-why-render',
    }, (api: DevtoolsPluginApi) => {
        // Расширение могло подключиться уже после stop() — тогда делать нечего.
        if (stopped) return

        api.addInspector({
            id: INSPECTOR_ID,
            label: 'Why render',
            treeFilterPlaceholder: 'filter by name or file',
        })

        api.addTimelineLayer({
            id: TIMELINE_ID,
            label: 'Why render',
            color: COLOR,
        })

        api.on.getInspectorTree((payload) => {
            if (payload.inspectorId !== INSPECTOR_ID) return
            payload.rootNodes = buildTree(scanner, payload.filter)
        })

        api.on.getInspectorState((payload) => {
            if (payload.inspectorId !== INSPECTOR_ID) return
            payload.state = buildState(scanner, payload.nodeId)
        })

        // Дерево обновляем по тому же сигналу, что и панель: реестр
        // нереактивный, и сам о себе DevTools не узнает.
        unsubscribe = scanner.registry.subscribe(() => {
            api.sendInspectorTree(INSPECTOR_ID)
            api.sendInspectorState(INSPECTOR_ID)
        })

        unsubscribeEvents = scanner.registry.onEvent((event) => {
            api.addTimelineEvent({
                layerId: TIMELINE_ID,
                event: {
                    time: api.now ? api.now() : Date.now(),
                    title: event.name,
                    subtitle: describeEvent(event, scanner),
                    groupId: event.uid,
                    data: {
                        component: event.name,
                        file: event.file ?? '—',
                        phase: event.phase,
                        duration: formatDuration(event.duration),
                        fps: event.fps,
                        reasons: event.reasons.map(reason => formatReason(reason, getMessages(scanner.options.locale))),
                        propChanges: event.propChanges.map(change =>
                            formatPropChange(change, getMessages(scanner.options.locale))),
                    },
                },
            })
        })
    })

    return () => {
        stopped = true
        unsubscribe?.()
        unsubscribeEvents?.()
    }
}
