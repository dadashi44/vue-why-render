/**
 * Формы, которые ждёт DevTools. Описаны у себя, а не взяты из
 * `@vue/devtools-api`: у пакета заявлен ноль зависимостей, и ради моста
 * в два десятка строк тащить дерево `@vue/devtools-kit` незачем.
 *
 * Контракт снят с `@vue/devtools-kit@8` — там же, где он реализован.
 * Это API плагинов шестой версии, и DevTools 7/8 его по-прежнему обслуживают.
 */
import type { App } from 'vue'

export interface InspectorNodeTag {
    label: string
    textColor: number
    backgroundColor: number
    tooltip?: string
}

export interface CustomInspectorNode {
    id: string
    label: string
    children?: CustomInspectorNode[]
    tags?: InspectorNodeTag[]
}

export interface InspectorStateEntry {
    key: string
    value: unknown
    editable?: boolean
}

export type CustomInspectorState = Record<string, InspectorStateEntry[]>

export interface GetInspectorTreePayload {
    app: App
    inspectorId: string
    filter: string
    rootNodes: CustomInspectorNode[]
}

export interface GetInspectorStatePayload {
    app: App
    inspectorId: string
    nodeId: string
    state: CustomInspectorState
}

export interface TimelineEventPayload {
    time: number
    data: Record<string, unknown>
    title?: string
    subtitle?: string
    groupId?: string | number
}

export interface DevtoolsPluginApi {
    on: {
        getInspectorTree: (handler: (payload: GetInspectorTreePayload) => void) => void
        getInspectorState: (handler: (payload: GetInspectorStatePayload) => void) => void
    }
    addInspector: (options: { id: string, label: string, icon?: string, treeFilterPlaceholder?: string }) => void
    sendInspectorTree: (inspectorId: string) => void
    sendInspectorState: (inspectorId: string) => void
    addTimelineLayer: (options: { id: string, label: string, color: number }) => void
    addTimelineEvent: (options: { layerId: string, event: TimelineEventPayload }) => void
    now?: () => number
}

export interface PluginDescriptor {
    id: string
    label: string
    app: App
    packageName?: string
    homepage?: string
    logo?: string
}

export type PluginSetupFunction = (api: DevtoolsPluginApi) => void

interface DevtoolsHook {
    emit: (event: string, ...args: unknown[]) => void
}

interface DevtoolsTarget {
    __VUE_DEVTOOLS_GLOBAL_HOOK__?: DevtoolsHook
    __VUE_DEVTOOLS_PLUGINS__?: Array<{ pluginDescriptor: PluginDescriptor, setupFn: PluginSetupFunction }>
}

function getTarget(): DevtoolsTarget | null {
    if (typeof window !== 'undefined') return window as unknown as DevtoolsTarget
    if (typeof globalThis !== 'undefined') return globalThis as unknown as DevtoolsTarget
    return null
}

/**
 * Регистрация плагина — весь мост целиком.
 *
 * Если расширение уже на странице, зовём хук напрямую. Если нет — кладём в
 * очередь `__VUE_DEVTOOLS_PLUGINS__`, откуда DevTools заберёт нас при
 * подключении. Порядок загрузки не фиксирован: расширение может появиться и
 * раньше приложения, и позже.
 */
export function setupDevtoolsPlugin(descriptor: PluginDescriptor, setupFn: PluginSetupFunction): void {
    const target = getTarget()
    if (!target) return

    const hook = target.__VUE_DEVTOOLS_GLOBAL_HOOK__
    if (hook) {
        hook.emit('devtools-plugin:setup', descriptor, setupFn)
        return
    }

    const queue = target.__VUE_DEVTOOLS_PLUGINS__ = target.__VUE_DEVTOOLS_PLUGINS__ ?? []
    queue.push({ pluginDescriptor: descriptor, setupFn })
}
