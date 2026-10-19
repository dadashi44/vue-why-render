/* eslint-disable no-console -- печать в консоль и есть назначение этого файла */
import { getMessages } from '../i18n'
import type { Locale } from '../i18n'
import { formatDuration, formatHint, formatPropChange, formatReason, shortFile } from '../panel/format'
import type { Report, ReportComponent } from './report'

export interface PrintOptions {
    /** Сколько компонентов в таблице. */
    limit?: number
    /** Язык подписей причин — по умолчанию английский, как и у панели. */
    locale?: Locale
}

/** Строка таблицы. Ключи — заголовки колонок, `console.table` берёт их как есть. */
export interface PrintRow {
    component: string
    file: string
    renders: number
    perSecond: number
    avg: string
    reason: string
}

function lastReason(item: ReportComponent, locale: Locale): string {
    const t = getMessages(locale)
    const change = item.propChanges[0]
    if (change) return formatPropChange(change, t)
    const reason = item.reasons[0]
    return reason ? formatReason(reason, t) : ''
}

/** Строки таблицы отдельно от печати — их удобно проверять и переиспользовать. */
export function reportRows(report: Report, options: PrintOptions = {}): PrintRow[] {
    const limit = options.limit ?? 20
    const locale = options.locale ?? 'en'
    const seconds = Math.max(report.meta.durationMs / 1000, 0.001)

    return report.components
        .filter(item => item.renderCount > 0)
        .slice(0, limit)
        .map(item => ({
            component: item.instances > 1 ? `${item.name} (${item.instances})` : item.name,
            file: shortFile(item.file),
            renders: item.renderCount,
            perSecond: Number((item.renderCount / seconds).toFixed(1)),
            avg: formatDuration(item.renderCount > 0 ? item.totalDuration / item.renderCount : 0),
            reason: lastReason(item, locale),
        }))
}

/**
 * Отчёт в консоль: сводка, таблица и подсказки свёрнутой группой.
 * Работает там, где панель выключена или мешает, и ничего не пишет на диск.
 */
export function printReport(report: Report, options: PrintOptions = {}): void {
    const t = getMessages(options.locale ?? 'en')
    const { meta, totals } = report
    const rate = meta.options.sampleRate ?? 1
    const sampled = rate < 1 ? ` · sampled ${Math.round(rate * 100)}%` : ''

    console.group(
        `[vue-why-render] ${totals.renders} renders in ${(meta.durationMs / 1000).toFixed(1)} s`
        + ` (${totals.rendersPerSecond.toFixed(1)}/s) · ${totals.components} components${sampled}`,
    )

    const rows = reportRows(report, options)
    if (rows.length) console.table(rows)
    else console.log('No renders recorded.')

    const hinted = report.components.filter(item => item.hints.length)
    if (hinted.length) {
        console.groupCollapsed(`hints (${hinted.length})`)
        for (const item of hinted) {
            for (const hint of item.hints) console.log(`${item.name}: ${formatHint(hint, t)}`)
        }
        console.groupEnd()
    }

    console.groupEnd()
}
