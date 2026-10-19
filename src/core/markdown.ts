import type { Locale, Messages } from '../i18n'
import { getMessages } from '../i18n'
import { formatDuration, formatHint, formatPropChange, formatReason, shortFile } from '../panel/format'
import { defaultOptions } from '../options'
import type { Report, ReportComponent, ReportOptions } from './report'
import { reasonKey } from './report'

export interface MarkdownOptions {
    /** Сколько строк в каждой таблице. */
    limit?: number
    /**
     * Язык подписей причин. По умолчанию английский: блок вставляют в issue,
     * а читает его мейнтейнер, чей язык заранее неизвестен.
     */
    locale?: Locale
}

/**
 * Значение для ячейки таблицы — внутри code span.
 *
 * Превью значений приходят из чужого приложения: `<div>` GitHub отрисует как
 * разметку, `*x*` — курсивом, а `|` разрежет таблицу. В code span разметка не
 * разбирается, остаётся экранировать `|` (GFM понимает `\|` и там) и переводы
 * строк. Если в самом тексте есть обратная кавычка — обрамляем двойными.
 */
function code(text: string): string {
    const flat = text.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|')
    const fence = flat.includes('`') ? '``' : '`'
    const pad = fence === '``' ? ' ' : ''
    return `${fence}${pad}${flat}${pad}${fence}`
}

function component(item: Pick<ReportComponent, 'name' | 'file' | 'instances'>): string {
    const file = item.file ? ` ${code(shortFile(item.file))}` : ''
    // Словами, а не «×2»: рядом колонка рендеров, и множитель путают с ней.
    const instances = item.instances > 1 ? ` · ${item.instances} instances` : ''
    return `${code(item.name)}${file}${instances}`
}

function table(head: string[], align: string[], rows: string[][]): string[] {
    return [
        `| ${head.join(' | ')} |`,
        `| ${align.join(' | ')} |`,
        ...rows.map(row => `| ${row.join(' | ')} |`),
    ]
}

function average(item: ReportComponent): number {
    return item.renderCount > 0 ? item.totalDuration / item.renderCount : 0
}

function lastReason(item: ReportComponent, t: Messages): string {
    // Тот же приоритет, что в панели: диф пропа знает про новую ссылку,
    // поэтому причина «проп X» из renderTriggered уступает ему место.
    const change = item.propChanges[0]
    if (change) return code(formatPropChange(change, t))
    const reason = item.reasons[0]
    return reason ? code(formatReason(reason, t)) : '—'
}

/** Опции, отличные от умолчаний, — только они и объясняют чужие цифры. */
function changedOptions(options: ReportOptions): string[] {
    const out: string[] = []
    if (options.includeMounts !== defaultOptions.includeMounts) out.push('`includeMounts`')
    if (options.trackReasons !== defaultOptions.trackReasons) out.push('`trackReasons: false`')
    if (options.trackProps !== defaultOptions.trackProps) out.push('`trackProps: false`')
    if (options.minDuration !== defaultOptions.minDuration) out.push(`\`minDuration: ${options.minDuration}\``)
    if (options.include.length) out.push(`include ${options.include.map(code).join(', ')}`)
    if (options.exclude.length) out.push(`exclude ${options.exclude.map(code).join(', ')}`)
    return out
}

interface ReasonCount {
    label: string
    renders: number
    components: Set<string>
}

/**
 * Самые частые причины — по событиям, а не по компонентам: у компонента
 * хранится только причина последнего рендера, а вопрос «что дёргает чаще
 * всего» — про все рендеры. События лежат в кольцевом буфере, так что это
 * последние `events.length` рендеров, о чём таблица и говорит.
 */
function countReasons(report: Report, t: Messages): ReasonCount[] {
    const counts = new Map<string, ReasonCount>()
    const bump = (key: string, label: string, name: string): void => {
        const entry = counts.get(key) ?? { label, renders: 0, components: new Set<string>() }
        entry.renders++
        entry.components.add(name)
        counts.set(key, entry)
    }

    for (const event of report.events) {
        const seen = new Set<string>()
        const changed = new Set(event.propChanges.map(change => change.key))
        for (const change of event.propChanges) {
            // «Новая ссылка» и «новая функция» — разные беды с разным лечением,
            // поэтому считаются отдельно от обычной смены значения.
            const kind = change.referenceOnly ? ':ref' : change.newFunction ? ':fn' : ''
            const suffix = change.referenceOnly ? t.referenceOnly : change.newFunction ? t.newFunction : ''
            const key = `props:${change.key}${kind}`
            if (seen.has(key)) continue
            seen.add(key)
            bump(key, `${t.source.props} ${change.key}${suffix}`, event.name)
        }
        for (const reason of event.reasons) {
            if (reason.source === 'props' && changed.has(reason.key)) continue
            const key = reasonKey(reason)
            if (seen.has(key)) continue
            seen.add(key)
            bump(key, `${t.source[reason.source]} ${reason.key}`, event.name)
        }
    }

    return [...counts.values()].sort((a, b) => b.renders - a.renders || a.label.localeCompare(b.label))
}

/**
 * Отчёт в Markdown для вставки в issue: текст виден прямо в треде, ничего
 * не надо скачивать и открывать. URL страницы сюда намеренно не попадает —
 * в публичном issue он засветил бы внутренний хост или токен в query.
 */
export function formatReportMarkdown(report: Report, options: MarkdownOptions = {}): string {
    const limit = options.limit ?? 10
    const t = getMessages(options.locale ?? 'en')
    const { meta, totals } = report
    const lines: string[] = []

    lines.push('### vue-why-render report', '')
    lines.push([
        `vue-why-render ${meta.package}`,
        `Vue ${meta.vue}`,
        `${(meta.durationMs / 1000).toFixed(1)} s`,
        `${totals.renders} renders (${totals.rendersPerSecond.toFixed(1)}/s)`,
        `${totals.components} components`,
    ].join(' · '))

    const changed = changedOptions(meta.options)
    lines.push('', `Options: ${changed.length ? changed.join(', ') : 'defaults'}`)

    const rate = meta.options.sampleRate ?? 1
    if (rate < 1) {
        lines.push('', `> Sampled: only ${Math.round(rate * 100)}% of renders were recorded, counts are not absolute.`)
    }

    // Нарушения — первыми: если бюджет задан и превышен, это и есть суть issue.
    const violations = report.violations ?? []
    if (violations.length) {
        lines.push('', '#### Budget violations', '')
        lines.push(...table(
            ['Component', 'Budget', 'Worst', 'Times', 'Reason'],
            ['---', '---', '---:', '---:', '---'],
            violations.slice(0, limit).map(item => [
                component({ name: item.name, file: item.file, instances: 1 }),
                item.kind === 'renders' ? `≤ ${item.limit} renders / ${item.per}ms` : `≤ ${item.limit}ms per update`,
                item.kind === 'renders' ? String(item.actual) : formatDuration(item.actual),
                String(item.count),
                item.reason ? code(item.reason) : '—',
            ]),
        ))
    }

    const top = report.components.filter(item => item.renderCount > 0).slice(0, limit)
    if (!top.length) {
        lines.push('', 'No renders recorded.')
        return lines.join('\n')
    }

    const seconds = Math.max(meta.durationMs / 1000, 0.001)
    lines.push('', '#### Most re-rendered', '')
    lines.push(...table(
        ['Component', 'Renders', '/s', 'Avg', 'Last reason'],
        ['---', '---:', '---:', '---:', '---'],
        top.map(item => [
            component(item),
            String(item.renderCount),
            (item.renderCount / seconds).toFixed(1),
            formatDuration(average(item)),
            lastReason(item, t),
        ]),
    ))

    const slow = report.components
        .filter(item => average(item) > 0)
        .sort((a, b) => average(b) - average(a))
        .slice(0, limit)
    if (slow.length) {
        lines.push('', '#### Slowest', '')
        lines.push(...table(
            ['Component', 'Avg', 'Max', 'Renders'],
            ['---', '---:', '---:', '---:'],
            slow.map(item => [
                component(item),
                formatDuration(average(item)),
                formatDuration(item.maxDuration),
                String(item.renderCount),
            ]),
        ))
    }

    const reasons = countReasons(report, t).slice(0, limit)
    if (reasons.length) {
        lines.push('', `#### Most frequent reasons (last ${report.events.length} renders)`, '')
        lines.push(...table(
            ['Reason', 'Renders', 'Components'],
            ['---', '---:', '---'],
            reasons.map(item => [
                code(item.label),
                String(item.renders),
                [...item.components].map(code).join(', '),
            ]),
        ))
    }

    const hinted = report.components.filter(item => item.hints.length).slice(0, limit)
    if (hinted.length) {
        lines.push('', '#### Hints', '')
        for (const item of hinted) {
            for (const hint of item.hints) lines.push(`- ${code(item.name)}: ${formatHint(hint, t)}`)
        }
    }

    return lines.join('\n')
}
