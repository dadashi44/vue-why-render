import { getMessages } from '../i18n'
import { formatPropChange, formatReason } from '../panel/format'
import { matches } from '../options'
import type { BudgetViolation, RenderBudget, RenderEvent, ResolvedOptions } from '../types'
import type { Registry } from './registry'
import { componentKey } from './report'

const DEFAULT_WINDOW = 1000

/** Бюджет после проверки: кривые числа выброшены, окно подставлено. */
interface CheckedBudget {
    include: RenderBudget['include']
    maxRenders: number | null
    per: number
    maxDuration: number | null
}

function positive(value: number | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function check(budget: RenderBudget): CheckedBudget | null {
    const checked: CheckedBudget = {
        include: budget.include,
        maxRenders: positive(budget.maxRenders),
        per: positive(budget.per) ?? DEFAULT_WINDOW,
        maxDuration: positive(budget.maxDuration),
    }
    // Бюджет без единого ограничения — опечатка в конфиге, а не намерение.
    return checked.maxRenders === null && checked.maxDuration === null ? null : checked
}

function appliesTo(budget: CheckedBudget, event: RenderEvent): boolean {
    if (!budget.include?.length) return true
    return budget.include.some(filter => matches(filter, event.name, event.file))
}

/** Причина рендера строкой — по-английски, как всё, что уходит в консоль и CI. */
function describe(event: RenderEvent): string | undefined {
    const t = getMessages('en')
    const change = event.propChanges[0]
    if (change) return formatPropChange(change, t)
    const reason = event.reasons[0]
    return reason ? formatReason(reason, t) : undefined
}

function message(violation: BudgetViolation): string {
    const what = violation.kind === 'renders'
        ? `rendered ${violation.actual} times in ${violation.per}ms (limit ${violation.limit})`
        : `took ${violation.actual.toFixed(1)}ms to update (limit ${violation.limit}ms)`
    const reason = violation.reason ? ` — last reason: ${violation.reason}` : ''
    return `[vue-why-render] budget exceeded: ${violation.name} ${what}${reason}`
}

/**
 * Следит за бюджетами по событиям реестра. Окно частоты — у каждого инстанса
 * своё: вопрос «этот компонент молотит?», а не «сколько всего строк в списке».
 * В консоль — один раз на компонент и вид нарушения, дальше только счётчик.
 *
 * Возвращает функцию отписки.
 */
export function watchBudgets(registry: Registry, options: ResolvedOptions): () => void {
    const budgets = options.budgets.map(check).filter((item): item is CheckedBudget => item !== null)
    if (!budgets.length) return () => {}

    // Отметки времени по инстансу и бюджету. Сброс реестра начинает сессию
    // заново, поэтому окна сбрасываются вместе с ним — по startedAt.
    const windows = new Map<string, number[]>()
    let session = registry.startedAt

    const report = (violation: BudgetViolation): void => {
        if (!registry.addViolation(violation)) return
        console.warn(message(violation))
        options.onBudgetExceeded?.(violation)
    }

    return registry.onEvent((event) => {
        if (registry.startedAt !== session) {
            session = registry.startedAt
            windows.clear()
        }

        budgets.forEach((budget, index) => {
            if (!appliesTo(budget, event)) return
            const key = componentKey(event)
            const base = { key, name: event.name, file: event.file, firstAt: event.timestamp, lastAt: event.timestamp, count: 1 }

            if (budget.maxRenders !== null) {
                const id = `${index}:${event.uid}`
                const stamps = windows.get(id) ?? []
                stamps.push(event.timestamp)
                // Окно целиком, а не лимит плюс один: длина окна и есть «худшее
                // значение» в отчёте. Отметки ушедших инстансов уходят с reset.
                while (stamps.length && event.timestamp - stamps[0] >= budget.per) stamps.shift()
                windows.set(id, stamps)
                if (stamps.length > budget.maxRenders) {
                    report({ ...base, kind: 'renders', limit: budget.maxRenders, actual: stamps.length, per: budget.per, reason: describe(event) })
                }
            }

            if (budget.maxDuration !== null && event.phase === 'update' && event.duration > budget.maxDuration) {
                report({ ...base, kind: 'duration', limit: budget.maxDuration, actual: event.duration, reason: describe(event) })
            }
        })
    })
}
