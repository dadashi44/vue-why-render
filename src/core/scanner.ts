import type { ComponentOptions, DebuggerEvent } from 'vue'
import type { RenderEvent, RenderPhase, ResolvedOptions, TrackedInstance } from '../types'
import { shouldTrack } from '../options'
import { Overlay } from '../overlay/canvas'
import { FpsMeter } from './fps'
import { getComponentBounds, getComponentFile, getComponentName } from './instance'
import { describeTrigger, dedupeReasons, diffProps, snapshotProps } from './reason'
import { Registry } from './registry'

const FLASH_WINDOW = 1000

/**
 * Инструмент отладки не имеет права ронять приложение, которое отлаживает.
 * Любая наша ошибка внутри хука компонента всплыла бы как ошибка рендера
 * чужого компонента, поэтому глушим её и один раз сообщаем в консоль.
 */
let warnedAboutCrash = false

function safe(label: string, fn: () => void): void {
    try {
        fn()
    }
    catch (error) {
        if (!warnedAboutCrash) {
            warnedAboutCrash = true
            console.warn(`[vue-why-render] сбой в ${label}, сканирование продолжается:`, error)
        }
    }
}

/**
 * Инструментирует приложение глобальным миксином и сводит вместе
 * реестр, оверлей и счётчик FPS.
 */
export class Scanner {
    readonly registry: Registry
    readonly options: ResolvedOptions
    private overlay: Overlay | null = null
    private fps = new FpsMeter()
    private active = true

    constructor(options: ResolvedOptions) {
        this.options = options
        this.registry = new Registry({ maxEvents: options.maxEvents })

        if (options.overlay && typeof document !== 'undefined') {
            this.overlay = new Overlay({
                displayDuration: options.displayDuration,
                showLabels: options.showLabels,
            })
        }
        this.fps.start()
    }

    isActive(): boolean {
        return this.active
    }

    setActive(active: boolean): void {
        this.active = active
        if (!active) this.overlay?.clearAll()
    }

    /** Миксин, который вешается на приложение. */
    createMixin(): ComponentOptions {
        // Хуки Options API должны получать компонент в this, поэтому сканер
        // приходится тащить в замыкание, а не превращать хуки в стрелки.
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const scanner = this

        return {
            mounted(this: { $: TrackedInstance }) {
                safe('mounted', () => scanner.onMounted(this.$))
            },
            beforeUpdate(this: { $: TrackedInstance }) {
                safe('beforeUpdate', () => scanner.onBeforeUpdate(this.$))
            },
            updated(this: { $: TrackedInstance }) {
                safe('updated', () => scanner.onUpdated(this.$))
            },
            unmounted(this: { $: TrackedInstance }) {
                safe('unmounted', () => scanner.onUnmounted(this.$))
            },
            renderTriggered(this: { $: TrackedInstance }, event: DebuggerEvent) {
                safe('renderTriggered', () => scanner.onRenderTriggered(this.$, event))
            },
        }
    }

    private init(instance: TrackedInstance): TrackedInstance['__vwr'] {
        if (instance.__vwr) return instance.__vwr

        const name = getComponentName(instance)
        const file = getComponentFile(instance)
        const state: NonNullable<TrackedInstance['__vwr']> = {
            uid: instance.uid,
            name,
            file,
            tracked: shouldTrack(name, this.options, file),
            renderStart: 0,
            reasons: [],
            propsSnapshot: null,
            flashTimer: null,
        }
        instance.__vwr = state

        if (state.tracked) {
            if (this.options.trackProps) {
                state.propsSnapshot = snapshotProps(instance.props as Record<string, unknown>)
            }
            this.registry.register({
                uid: instance.uid,
                name,
                file,
                parentUid: this.resolveParentUid(instance),
            })
        }
        return state
    }

    /**
     * Ближайший отслеживаемый предок.
     * Идём по цепочке сами, а не спрашиваем реестр: mounted у детей срабатывает
     * раньше, чем у родителей, так что на момент вызова предка там ещё нет.
     */
    private resolveParentUid(instance: TrackedInstance): number | null {
        let parent = instance.parent as TrackedInstance | null
        while (parent) {
            const parentState = this.init(parent)
            if (parentState?.tracked) return parentState.uid
            parent = parent.parent as TrackedInstance | null
        }
        return null
    }

    private onMounted(instance: TrackedInstance): void {
        const state = this.init(instance)
        if (!state?.tracked || !this.active) return
        if (!this.options.includeMounts) return
        this.emit(instance, state, 'mount', 0)
    }

    private onBeforeUpdate(instance: TrackedInstance): void {
        const state = this.init(instance)
        if (!state?.tracked || !this.active) return
        // Снимок пропсов здесь брать бесполезно: Vue успевает обновить их
        // в updateComponentPreRender ещё до beforeUpdate. Сравниваем со снимком
        // предыдущего цикла, который лежит в state с прошлого updated.
        state.renderStart = performance.now()
    }

    private onUpdated(instance: TrackedInstance): void {
        const state = instance.__vwr
        if (!state?.tracked || !this.active) return

        const duration = state.renderStart > 0 ? performance.now() - state.renderStart : 0
        state.renderStart = 0
        if (duration < this.options.minDuration) {
            state.reasons = []
            if (this.options.trackProps) {
                state.propsSnapshot = snapshotProps(instance.props as Record<string, unknown>)
            }
            return
        }
        this.emit(instance, state, 'update', duration)
    }

    private onRenderTriggered(instance: TrackedInstance, event: DebuggerEvent): void {
        if (!this.options.trackReasons || !this.active) return
        const state = this.init(instance)
        if (!state?.tracked) return
        // Причины копятся между триггером и updated — там их и заберём.
        if (state.reasons.length < 32) {
            state.reasons.push(describeTrigger(event, instance))
        }
    }

    private onUnmounted(instance: TrackedInstance): void {
        const state = instance.__vwr
        if (!state) return
        if (state.flashTimer) clearTimeout(state.flashTimer)
        this.overlay?.clear(String(state.uid))
        this.registry.unregister(state.uid)
        instance.__vwr = undefined
    }

    private emit(
        instance: TrackedInstance,
        state: NonNullable<TrackedInstance['__vwr']>,
        phase: RenderPhase,
        duration: number,
    ): void {
        const reasons = dedupeReasons(state.reasons)
        const currentProps = this.options.trackProps
            ? snapshotProps(instance.props as Record<string, unknown>)
            : null
        const propChanges = this.options.trackProps && phase === 'update'
            ? diffProps(state.propsSnapshot, currentProps)
            : []
        state.reasons = []
        state.propsSnapshot = currentProps

        const event: RenderEvent = {
            uid: state.uid,
            name: state.name,
            file: state.file,
            phase,
            duration,
            fps: this.fps.value(),
            timestamp: Date.now(),
            reasons,
            propChanges,
        }

        this.registry.record(event)
        this.options.onRender?.(event)

        if (this.registry.isPaused()) return
        this.highlight(instance, state, event)
    }

    private highlight(
        instance: TrackedInstance,
        state: NonNullable<TrackedInstance['__vwr']>,
        event: RenderEvent,
    ): void {
        if (!this.overlay) return

        const record = this.registry.get(state.uid)
        const flashCount = record?.flashCount ?? 1
        const bounds = getComponentBounds(instance)
        if (bounds.width === 0 && bounds.height === 0) return

        this.overlay.highlight(
            String(state.uid),
            bounds,
            buildLabel(state.name, flashCount, event),
            flashCount / this.options.hotThreshold,
        )

        // Окно «жара»: без сброса счётчик копится всю сессию и всё становится красным.
        if (state.flashTimer) clearTimeout(state.flashTimer)
        state.flashTimer = setTimeout(() => {
            this.registry.resetFlashCount(state.uid)
            state.flashTimer = null
        }, FLASH_WINDOW)
    }

    dispose(): void {
        this.active = false
        this.fps.stop()
        this.overlay?.dispose()
        this.overlay = null
        this.registry.clear()
    }
}

export function buildLabel(name: string, flashCount: number, event: RenderEvent): string {
    const parts = [`${name} ×${flashCount}`]
    if (event.duration > 0) parts.push(`${event.duration.toFixed(1)}ms`)

    const reason = event.reasons[0]
    if (reason) parts.push(reason.key)
    else if (event.propChanges[0]) parts.push(`prop ${event.propChanges[0].key}`)

    return parts.join(' · ')
}
