export type Scenario = 'home' | 'query'

export interface TimelineRow {
    name: string
    scenario: Scenario
    before: number
    after: number
}

/** Числа кейса BIGPLAY: рендеры за сценарий до и после исправления. */
export const bigplayRows: TimelineRow[] = [
    { name: 'card', scenario: 'home', before: 600, after: 10 },
    { name: 'FinishOfRegistrationTimer', scenario: 'home', before: 120, after: 2 },
    { name: 'ui-logo', scenario: 'query', before: 20, after: 0 },
    { name: 'navbar', scenario: 'query', before: 10, after: 0 },
    { name: 'footer', scenario: 'query', before: 10, after: 0 },
]

/** Больше отметок на дорожке не нарисовать: точный счёт показывает цифра справа. */
export const MAX_TICKS = 40

/** Позиции отметок в процентах (0–100), равномерно. */
export function ticks(count: number): number[] {
    const n = Math.min(count, MAX_TICKS)
    return Array.from({ length: n }, (_, i) => Math.round(((i + 0.5) / n) * 1000) / 10)
}

export function isHot(count: number): boolean {
    return count > 10
}
