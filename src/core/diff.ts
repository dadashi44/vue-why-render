import type { Report, ReportComponent, ReportOptions } from './report'
import { REPORT_FORMAT, reasonKey } from './report'

export type DiffStatus = 'improved' | 'regressed' | 'unchanged' | 'added' | 'removed'

export interface ComponentDiff {
    key: string
    name: string
    file?: string
    status: DiffStatus
    before: number
    after: number
    delta: number
    /** Доля изменения: -0.83 — это минус 83%. null, когда делить не на что. */
    deltaRatio: number | null
    /** Те же числа на секунду сессии — честное сравнение при разной длительности. */
    beforePerSecond: number
    afterPerSecond: number
    /** Причины, которых в «после» больше нет, и новые. */
    reasonsGone: string[]
    reasonsNew: string[]
}

export interface ReportDiff {
    /** Всё, что делает сравнение нечестным. Пустой массив — сравнивать можно. */
    warnings: string[]
    totals: {
        before: number
        after: number
        delta: number
        deltaRatio: number | null
        beforePerSecond: number
        afterPerSecond: number
    }
    /** Сначала регрессии, потом улучшения, потом остальное. */
    components: ComponentDiff[]
}

/** Насколько длительности сессий могут расходиться, прежде чем это стоит упомянуть. */
const DURATION_TOLERANCE = 0.25

function ratio(before: number, after: number): number | null {
    if (before === 0) return null
    return (after - before) / before
}

function perSecond(count: number, durationMs: number): number {
    return count / Math.max(durationMs / 1000, 0.001)
}

function sameFilters(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false
    const left = [...a].sort()
    const right = [...b].sort()
    return left.every((item, index) => item === right[index])
}

function optionWarnings(before: ReportOptions, after: ReportOptions): string[] {
    const out: string[] = []

    // Эти три меняют состав событий, а значит и счётчики. Без предупреждения
    // дифф покажет «минус 80%» там, где просто поменяли фильтр.
    if (before.includeMounts !== after.includeMounts) {
        out.push(`includeMounts differs (${before.includeMounts} → ${after.includeMounts}): mounts are counted in one report and not the other`)
    }
    if (before.minDuration !== after.minDuration) {
        out.push(`minDuration differs (${before.minDuration} → ${after.minDuration}ms): the reports drop a different set of fast updates`)
    }
    if (!sameFilters(before.include, after.include) || !sameFilters(before.exclude, after.exclude)) {
        out.push('include/exclude differ: the reports watch different sets of components')
    }
    if (before.trackReasons !== after.trackReasons) {
        out.push(`trackReasons differs (${before.trackReasons} → ${after.trackReasons}): reasons are missing from one side`)
    }
    if (before.trackProps !== after.trackProps) {
        out.push(`trackProps differs (${before.trackProps} → ${after.trackProps}): prop changes are missing from one side`)
    }

    return out
}

function statusOf(before: number, after: number, existedBefore: boolean, existsAfter: boolean): DiffStatus {
    if (!existedBefore) return 'added'
    if (!existsAfter) return 'removed'
    if (after < before) return 'improved'
    if (after > before) return 'regressed'
    return 'unchanged'
}

/** Порядок вывода: регрессия важнее улучшения — её ищут, а не празднуют. */
const STATUS_ORDER: Record<DiffStatus, number> = {
    regressed: 0,
    added: 1,
    improved: 2,
    unchanged: 3,
    removed: 4,
}

/**
 * Сравнение двух отчётов.
 *
 * Компоненты сопоставляются по ключу `file::name`: uid живёт одну сессию и
 * между отчётами бессмыслен. Несколько инстансов одного компонента уже сведены
 * в агрегат на стороне createReport — сопоставлять конкретные экземпляры нельзя,
 * их порядок между запусками не воспроизводится.
 */
export function diffReports(before: Report, after: Report): ReportDiff {
    const warnings: string[] = []

    if (before.meta.format !== after.meta.format) {
        warnings.push(`report formats differ (${before.meta.format} → ${after.meta.format})`)
    }
    if (before.meta.format > REPORT_FORMAT || after.meta.format > REPORT_FORMAT) {
        warnings.push(`report format is newer than supported (${REPORT_FORMAT})`)
    }
    if (before.meta.package !== after.meta.package) {
        warnings.push(`captured by different versions of vue-why-render (${before.meta.package} → ${after.meta.package})`)
    }

    const durations = [before.meta.durationMs, after.meta.durationMs]
    const longest = Math.max(...durations)
    const shortest = Math.min(...durations)
    if (longest > 0 && (longest - shortest) / longest > DURATION_TOLERANCE) {
        warnings.push(
            `sessions differ in length (${Math.round(before.meta.durationMs)}ms → ${Math.round(after.meta.durationMs)}ms): compare the per-second numbers, not the raw counts`,
        )
    }

    warnings.push(...optionWarnings(before.meta.options, after.meta.options))

    const beforeByKey = new Map(before.components.map(item => [item.key, item]))
    const afterByKey = new Map(after.components.map(item => [item.key, item]))
    const keys = new Set([...beforeByKey.keys(), ...afterByKey.keys()])

    const components: ComponentDiff[] = []
    for (const key of keys) {
        const left = beforeByKey.get(key)
        const right = afterByKey.get(key)
        const source = (right ?? left) as ReportComponent

        const beforeCount = left?.renderCount ?? 0
        const afterCount = right?.renderCount ?? 0

        const beforeReasons = new Set((left?.reasons ?? []).map(reasonKey))
        const afterReasons = new Set((right?.reasons ?? []).map(reasonKey))

        components.push({
            key,
            name: source.name,
            file: source.file,
            status: statusOf(beforeCount, afterCount, Boolean(left), Boolean(right)),
            before: beforeCount,
            after: afterCount,
            delta: afterCount - beforeCount,
            deltaRatio: ratio(beforeCount, afterCount),
            beforePerSecond: perSecond(beforeCount, before.meta.durationMs),
            afterPerSecond: perSecond(afterCount, after.meta.durationMs),
            reasonsGone: [...beforeReasons].filter(item => !afterReasons.has(item)),
            reasonsNew: [...afterReasons].filter(item => !beforeReasons.has(item)),
        })
    }

    components.sort((a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
        || Math.abs(b.delta) - Math.abs(a.delta)
        || a.key.localeCompare(b.key))

    return {
        warnings,
        totals: {
            before: before.totals.renders,
            after: after.totals.renders,
            delta: after.totals.renders - before.totals.renders,
            deltaRatio: ratio(before.totals.renders, after.totals.renders),
            beforePerSecond: before.totals.rendersPerSecond,
            afterPerSecond: after.totals.rendersPerSecond,
        },
        components,
    }
}

function percent(value: number | null): string {
    if (value === null) return '—'
    const rounded = Math.round(value * 100)
    return `${rounded > 0 ? '+' : ''}${rounded}%`
}

/**
 * Дифф в строки для консоли или issue.
 * Предупреждения идут первыми и всегда: молча показанный «минус 80%»,
 * полученный сменой фильтра, хуже отсутствия диффа.
 */
export function formatDiff(diff: ReportDiff, limit = 20): string[] {
    const lines: string[] = []

    for (const warning of diff.warnings) lines.push(`! ${warning}`)
    if (diff.warnings.length) lines.push('')

    lines.push(`total ×${diff.totals.before} → ×${diff.totals.after}  ${percent(diff.totals.deltaRatio)}`)
    lines.push('')

    const shown = diff.components.filter(item => item.status !== 'unchanged').slice(0, limit)
    if (!shown.length) {
        lines.push('nothing changed')
        return lines
    }

    const width = Math.max(...shown.map(item => item.name.length))
    for (const item of shown) {
        const head = `${item.name.padEnd(width)}  ×${item.before} → ×${item.after}  ${percent(item.deltaRatio).padStart(6)}`
        const notes: string[] = []
        if (item.status === 'added') notes.push('new component')
        if (item.status === 'removed') notes.push('gone')
        for (const reason of item.reasonsGone) notes.push(`reason gone: ${reason}`)
        for (const reason of item.reasonsNew) notes.push(`new reason: ${reason}`)
        lines.push(notes.length ? `${head}   ${notes.join(', ')}` : head)
    }

    const hidden = diff.components.filter(item => item.status !== 'unchanged').length - shown.length
    if (hidden > 0) lines.push(`… and ${hidden} more`)

    return lines
}
