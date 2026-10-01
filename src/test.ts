import { nextTick } from 'vue'
import type { App, Plugin } from 'vue'
import { scan } from './index.js'
import type { RenderEvent, ScanHandle, VueWhyRenderOptions } from './index.js'

/**
 * Проверки рендеров для тестов.
 *
 * Инструмент отладки умеет считать рендеры — значит, его можно повернуть
 * в сторону регрессий: лишние рендеры перестают возвращаться после того,
 * как их один раз починили.
 *
 * Вход отдельный (`vue-why-render/test`), потому что он тянет за собой
 * привязку к жизненному циклу теста и в приложении не нужен.
 */

/** Кого считаем: имя, регулярка или сам компонент. */
export type RenderTarget = string | RegExp | { name?: string, __name?: string }

export interface RenderTracker {
    handle: ScanHandle
    /** Все события с момента установки. */
    events: RenderEvent[]
    stop: () => void
}

let active: RenderTracker | null = null

/**
 * Опции, которые в тесте не обсуждаются.
 *
 * Панель и оверлей трогают document и засоряют разметку, по которой тест
 * ищет элементы. Монтирования не считаются: проверяют лишние перерисовки,
 * а первый рендер лишним не бывает.
 */
const TEST_OPTIONS: VueWhyRenderOptions = {
    enabled: true,
    panel: false,
    overlay: false,
    includeMounts: false,
    // Без причин сообщение об ошибке теряет весь смысл: именно оно
    // объясняет, почему компонент перерисовался.
    trackReasons: true,
    trackProps: true,
    minDuration: 0,
}

/**
 * Плагин для `mount(App, { global: { plugins: [renderTracking()] } })`.
 * Именно плагин, а не функция от `app`: test-utils создаёт приложение сам
 * и наружу его не отдаёт.
 */
export function renderTracking(options: VueWhyRenderOptions = {}): Plugin {
    return {
        install(app: App) {
            stopRenderTracking()

            const events: RenderEvent[] = []
            const handle = scan(app, {
                ...TEST_OPTIONS,
                ...options,
                onRender(event) {
                    events.push(event)
                    options.onRender?.(event)
                },
            })

            if (!handle) return

            active = {
                handle,
                events,
                stop() {
                    handle.stop()
                    if (active?.handle === handle) active = null
                },
            }
        },
    }
}

/** Снять слежение. Зовите в afterEach, иначе трекер переживёт тест. */
export function stopRenderTracking(): void {
    active?.stop()
    active = null
}

export function getRenderTracker(): RenderTracker | null {
    return active
}

function requireTracker(): RenderTracker {
    if (!active) {
        throw new Error(
            '[vue-why-render] no render tracking is active. '
            + 'Mount with renderTracking(): mount(App, { global: { plugins: [renderTracking()] } })',
        )
    }
    return active
}

function targetName(target: RenderTarget): string {
    if (typeof target === 'string') return target
    if (target instanceof RegExp) return String(target)
    return target.name ?? target.__name ?? '<anonymous component>'
}

function matches(target: RenderTarget, event: RenderEvent): boolean {
    if (typeof target === 'string') return event.name === target
    if (target instanceof RegExp) return target.test(event.name)
    const name = target.name ?? target.__name
    return name !== undefined && event.name === name
}

/**
 * События рендера, случившиеся за время действия.
 *
 * `nextTick` обязателен: обновления во Vue асинхронные, и без него
 * проверка увидит ноль рендеров независимо от того, что случилось.
 */
export async function recordRenders(action: () => unknown): Promise<RenderEvent[]> {
    const tracker = requireTracker()
    const start = tracker.events.length
    await action()
    await nextTick()
    return tracker.events.slice(start)
}

/** Описание причин для сообщения об ошибке — ради него всё и затевалось. */
function explain(events: RenderEvent[]): string {
    const lines: string[] = []
    const seen = new Set<string>()

    for (const event of events) {
        // Причина «проп badge» и изменение этого же пропа — одно и то же
        // событие с двух сторон. В панели дубль уже отфильтрован, в
        // сообщении об ошибке он тем более не нужен.
        const changed = new Set(event.propChanges.map(change => change.key))

        for (const reason of event.reasons) {
            if (reason.source === 'props' && changed.has(reason.key)) continue

            const line = `${reason.source} ${reason.key}`
                + (reason.oldValue !== undefined ? `: ${reason.oldValue} -> ${reason.newValue}` : '')
            if (!seen.has(line)) {
                seen.add(line)
                lines.push(line)
            }
        }
        for (const change of event.propChanges) {
            const verdict = change.referenceOnly
                ? ' (new reference, same value)'
                : change.newFunction ? ' (a new function every render)' : ''
            const line = `prop ${change.key}: ${change.oldValue} -> ${change.newValue}${verdict}`
            if (!seen.has(line)) {
                seen.add(line)
                lines.push(line)
            }
        }
    }

    if (!lines.length) return ''
    return `\nreasons:\n${lines.map(line => `  - ${line}`).join('\n')}`
}

function fail(target: RenderTarget, expected: string, matched: RenderEvent[]): never {
    const name = targetName(target)
    const file = matched.find(event => event.file)?.file
    throw new Error(
        `[vue-why-render] expected ${name} ${expected}, but it re-rendered ${matched.length} time(s)`
        + (file ? `\nat ${file}` : '')
        + explain(matched),
    )
}

export interface RenderExpectation {
    /** Ровно столько перерисовок за время действия. */
    toBe: (count: number, action: () => unknown) => Promise<RenderEvent[]>
    /** Не больше указанного — для случаев, где точное число хрупко. */
    toBeAtMost: (count: number, action: () => unknown) => Promise<RenderEvent[]>
}

/**
 * ```ts
 * await expectRenders(ProductCard).toBe(0, async () => {
 *     await input.setValue('mouse')
 * })
 * ```
 */
export function expectRenders(target: RenderTarget): RenderExpectation {
    return {
        async toBe(count, action) {
            const matched = (await recordRenders(action)).filter(event => matches(target, event))
            if (matched.length !== count) {
                fail(target, `to re-render ${count} time(s)`, matched)
            }
            return matched
        },
        async toBeAtMost(count, action) {
            const matched = (await recordRenders(action)).filter(event => matches(target, event))
            if (matched.length > count) {
                fail(target, `to re-render at most ${count} time(s)`, matched)
            }
            return matched
        },
    }
}
