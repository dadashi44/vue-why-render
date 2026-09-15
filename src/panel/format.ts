import type { ComponentRecord, PropChange, RenderReason } from '../types'

const SOURCE_LABEL: Record<RenderReason['source'], string> = {
    props: 'проп',
    setup: 'состояние',
    data: 'data',
    store: 'стор',
    array: 'массив',
    collection: 'коллекция',
    unknown: 'реактивность',
}

/** Строка вида «проп title: "a" → "b"». */
export function formatReason(reason: RenderReason): string {
    const label = `${SOURCE_LABEL[reason.source]} ${reason.key}`
    if (reason.oldValue !== undefined && reason.newValue !== undefined) {
        return `${label}: ${reason.oldValue} → ${reason.newValue}`
    }
    if (reason.type !== 'set') return `${label} (${reason.type})`
    return label
}

export function formatPropChange(change: PropChange): string {
    const suffix = change.referenceOnly ? ' — новая ссылка, значение то же' : ''
    return `проп ${change.key}: ${change.oldValue} → ${change.newValue}${suffix}`
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

export function matchesQuery(record: ComponentRecord, query: string): boolean {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return true
    return record.name.toLowerCase().includes(trimmed)
        || (record.file ?? '').toLowerCase().includes(trimmed)
}

/** Ссылка на открытие файла в IDE через дев-сервер. */
export function buildEditorUrl(template: string, file: string): string {
    return template.replace('{file}', encodeURIComponent(file))
}
