import type { Messages } from '../i18n'
import type { ComponentRecord, PropChange, RenderReason } from '../types'

/** Строка вида «проп title: "a" → "b"». */
export function formatReason(reason: RenderReason, t: Messages): string {
    const label = `${t.source[reason.source]} ${reason.key}`
    if (reason.oldValue !== undefined && reason.newValue !== undefined) {
        return `${label}: ${reason.oldValue} → ${reason.newValue}`
    }
    if (reason.type !== 'set') return `${label} (${reason.type})`
    return label
}

export function formatPropChange(change: PropChange, t: Messages): string {
    const suffix = change.referenceOnly ? t.referenceOnly : ''
    return `${t.source.props} ${change.key}: ${change.oldValue} → ${change.newValue}${suffix}`
}

export function formatDuration(ms: number): string {
    if (ms <= 0) return '—'
    if (ms < 1) return `${ms.toFixed(2)}ms`
    if (ms < 100) return `${ms.toFixed(1)}ms`
    return `${Math.round(ms)}ms`
}

export function averageDuration(record: ComponentRecord): number {
    return record.renderCount > 0 ? record.totalDuration / record.renderCount : 0
}

/** Короткое имя файла для подписи. */
export function shortFile(file?: string): string {
    if (!file) return ''
    const parts = file.split(/[\\/]/)
    return parts.slice(-2).join('/')
}

/**
 * Строки «почему» для одной записи.
 * Изменение пропа прилетает дважды: из renderTriggered и из дифа пропсов.
 * Оставляем версию из дифа — она дополнительно знает про новую ссылку.
 */
export function whyLines(record: ComponentRecord, t: Messages): string[] {
    const changedProps = new Set(record.lastPropChanges.map(change => change.key))
    const fromReasons = record.lastReasons
        .filter(reason => !(reason.source === 'props' && changedProps.has(reason.key)))
        .map(reason => formatReason(reason, t))

    return [...fromReasons, ...record.lastPropChanges.map(change => formatPropChange(change, t))]
}

export function matchesQuery(record: ComponentRecord, query: string): boolean {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return true
    return record.name.toLowerCase().includes(trimmed)
        || (record.file ?? '').toLowerCase().includes(trimmed)
}
