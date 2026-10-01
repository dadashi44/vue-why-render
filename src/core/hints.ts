import type { ComponentRecord, PropChange, RenderReason, ResolvedOptions } from '../types'

/**
 * Подсказки — это выводы из данных рантайма, а не чтение исходника.
 *
 * Пакет знает, что пропс пришёл новой ссылкой, но не знает, откуда:
 * из вызова в шаблоне, из computed без мемоизации или из стора. Поэтому
 * формулировки — версии («похоже, объект собирается заново»), а не диагнозы.
 * Инструмент, уверенно советующий не то, хуже инструмента, который просто
 * показывает факты.
 */
export type HintCode = 'newReference' | 'newFunction' | 'parentRender'

export interface Hint {
    code: HintCode
    /** Пропы, из-за которых подсказка появилась. Для parentRender — пусто. */
    keys: string[]
}

export interface HintInput {
    renderCount: number
    /** Рендеры, которые были именно обновлениями. */
    updateCount: number
    reasons: RenderReason[]
    propChanges: PropChange[]
}

/**
 * Подсказки по одному компоненту.
 *
 * `options` нужны не для красоты: при `trackProps: false` пропы не диффятся,
 * при `trackReasons: false` не собираются причины — и «ничего не менялось»
 * означало бы не «перерисовал родитель», а «мы не смотрели». Молчать в таком
 * случае честнее, чем советовать v-memo наугад.
 */
export function hintsFor(input: HintInput, options: Pick<ResolvedOptions, 'trackProps' | 'trackReasons'>): Hint[] {
    const hints: Hint[] = []
    if (input.renderCount <= 0) return hints

    if (options.trackProps) {
        const newReference = input.propChanges.filter(change => change.referenceOnly)
        if (newReference.length) {
            hints.push({ code: 'newReference', keys: newReference.map(change => change.key) })
        }

        const newFunction = input.propChanges.filter(change => change.newFunction)
        if (newFunction.length) {
            hints.push({ code: 'newFunction', keys: newFunction.map(change => change.key) })
        }
    }

    // Свои реактивные данные не трогали и пропы не менялись — значит
    // перерисовка пришла сверху. Два условия обязательны:
    // обновление вообще было (иначе компонент просто смонтировался, и звать
    // его в v-memo — вредный совет), и мы смотрели за обоими источниками,
    // иначе «ничего не менялось» означает «мы не смотрели».
    if (input.updateCount > 0 && options.trackProps && options.trackReasons
        && input.reasons.length === 0 && input.propChanges.length === 0) {
        hints.push({ code: 'parentRender', keys: [] })
    }

    return hints
}

/** То же для живой записи реестра — панель работает с ней. */
export function hintsForRecord(
    record: ComponentRecord,
    options: Pick<ResolvedOptions, 'trackProps' | 'trackReasons'>,
): Hint[] {
    return hintsFor({
        renderCount: record.renderCount,
        updateCount: record.updateCount,
        reasons: record.lastReasons,
        propChanges: record.lastPropChanges,
    }, options)
}
