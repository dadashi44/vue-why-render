import { version as vueVersion } from 'vue'
import type { NameFilter, PropChange, RenderEvent, RenderReason, ResolvedOptions } from '../types'
import { VERSION } from '../version'
import type { Registry } from './registry'

/**
 * Версия формата отчёта. Поднимается при несовместимом изменении — дифф и
 * импорт обязаны ругаться, а не молча показывать чушь на чужой структуре.
 */
export const REPORT_FORMAT = 1

/** Стабильный ключ компонента между сессиями. */
export function componentKey(record: { name: string, file?: string }): string {
    return record.file ? `${record.file}::${record.name}` : record.name
}

/**
 * Фильтр в читаемый вид. Регулярка и строка переносятся как есть, функция —
 * только по имени: тело в отчёте бесполезно, а вот факт, что фильтр был,
 * важен для сопоставимости двух сессий.
 */
export function describeFilter(filter: NameFilter): string {
    if (filter instanceof RegExp) return filter.toString()
    if (typeof filter === 'function') return `fn:${filter.name || 'anonymous'}`
    return filter
}

/**
 * Срез опций, влияющих на то, что вообще попало в счётчики.
 * Без него чужой отчёт нечитаем: непонятно, то ли компонент не перерисовывался,
 * то ли его отфильтровали.
 */
export interface ReportOptions {
    includeMounts: boolean
    trackReasons: boolean
    trackProps: boolean
    minDuration: number
    hotThreshold: number
    maxEvents: number
    include: string[]
    exclude: string[]
}

export interface ReportMeta {
    format: number
    package: string
    vue: string
    url?: string
    userAgent?: string
    /** Когда снят отчёт. */
    createdAt: number
    /** Когда началась сессия (последний reset). */
    startedAt: number
    durationMs: number
    options: ReportOptions
}

/** Компонент в отчёте — агрегат по всем живым инстансам с этим ключом. */
export interface ReportComponent {
    key: string
    name: string
    file?: string
    /** Сколько инстансов попало в агрегат. */
    instances: number
    renderCount: number
    totalDuration: number
    maxDuration: number
    /** Причины последнего рендера — по одной на инстанс, без повторов. */
    reasons: RenderReason[]
    propChanges: PropChange[]
}

export interface Report {
    meta: ReportMeta
    totals: {
        renders: number
        components: number
        rendersPerSecond: number
    }
    components: ReportComponent[]
    events: RenderEvent[]
}

function reportOptions(options: ResolvedOptions): ReportOptions {
    return {
        includeMounts: options.includeMounts,
        trackReasons: options.trackReasons,
        trackProps: options.trackProps,
        minDuration: options.minDuration,
        hotThreshold: options.hotThreshold,
        maxEvents: options.maxEvents,
        include: options.include.map(describeFilter),
        exclude: options.exclude.map(describeFilter),
    }
}

/** Ключ причины — по нему причины сравниваются между отчётами. */
export function reasonKey(reason: RenderReason): string {
    return `${reason.source}:${reason.key}`
}

export interface CreateReportInit {
    registry: Registry
    options: ResolvedOptions
    now?: () => number
    url?: string
    userAgent?: string
}

export function createReport(init: CreateReportInit): Report {
    const now = init.now ?? (() => Date.now())
    const snapshot = init.registry.snapshot()
    const createdAt = now()
    const durationMs = Math.max(0, createdAt - snapshot.startedAt)

    const byKey = new Map<string, ReportComponent>()
    for (const record of snapshot.records) {
        const key = componentKey(record)
        const existing = byKey.get(key)
        if (existing) {
            existing.instances++
            existing.renderCount += record.renderCount
            existing.totalDuration += record.totalDuration
            existing.maxDuration = Math.max(existing.maxDuration, record.maxDuration)
            for (const reason of record.lastReasons) {
                if (!existing.reasons.some(item => reasonKey(item) === reasonKey(reason))) {
                    existing.reasons.push(reason)
                }
            }
            for (const change of record.lastPropChanges) {
                if (!existing.propChanges.some(item => item.key === change.key)) {
                    existing.propChanges.push(change)
                }
            }
            continue
        }
        byKey.set(key, {
            key,
            name: record.name,
            file: record.file,
            instances: 1,
            renderCount: record.renderCount,
            totalDuration: record.totalDuration,
            maxDuration: record.maxDuration,
            reasons: [...record.lastReasons],
            propChanges: [...record.lastPropChanges],
        })
    }

    const components = [...byKey.values()].sort((a, b) =>
        b.renderCount - a.renderCount || a.key.localeCompare(b.key))

    const seconds = Math.max(durationMs / 1000, 0.001)

    return {
        meta: {
            format: REPORT_FORMAT,
            package: VERSION,
            vue: vueVersion,
            url: init.url ?? (typeof location === 'undefined' ? undefined : location.href),
            userAgent: init.userAgent
                ?? (typeof navigator === 'undefined' ? undefined : navigator.userAgent),
            createdAt,
            startedAt: snapshot.startedAt,
            durationMs,
            options: reportOptions(init.options),
        },
        totals: {
            renders: snapshot.totalRenders,
            components: byKey.size,
            rendersPerSecond: snapshot.totalRenders / seconds,
        },
        components,
        events: snapshot.events,
    }
}

/** Отчёт в JSON. Отступ в два пробела — файл кладут в issue, его читают глазами. */
export function serializeReport(report: Report): string {
    return JSON.stringify(report, null, 2)
}

export class ReportParseError extends Error {
    constructor(message: string) {
        super(`[vue-why-render] ${message}`)
        this.name = 'ReportParseError'
    }
}

/**
 * Разбор отчёта с проверкой. Строгая: отчёт приходит из чужих рук, и тихо
 * проглоченный мусор превратится в неверные выводы о чужом приложении.
 */
export function parseReport(input: string | unknown): Report {
    let data: unknown = input
    if (typeof input === 'string') {
        try {
            data = JSON.parse(input)
        }
        catch (error) {
            throw new ReportParseError(`report is not valid JSON: ${(error as Error).message}`)
        }
    }

    if (!data || typeof data !== 'object') {
        throw new ReportParseError('report must be an object')
    }

    const report = data as Partial<Report>
    if (!report.meta || typeof report.meta !== 'object') {
        throw new ReportParseError('report has no meta')
    }
    if (typeof report.meta.format !== 'number') {
        throw new ReportParseError('report has no format version')
    }
    if (report.meta.format > REPORT_FORMAT) {
        throw new ReportParseError(
            `report format ${report.meta.format} is newer than supported ${REPORT_FORMAT} — update vue-why-render`,
        )
    }
    if (!Array.isArray(report.components)) {
        throw new ReportParseError('report has no components')
    }
    if (!Array.isArray(report.events)) {
        throw new ReportParseError('report has no events')
    }

    return report as Report
}

/**
 * Скачать отчёт файлом. Имя по умолчанию содержит отметку времени: отчётов
 * обычно два — до и после правки, и их надо различать в папке загрузок.
 */
export function downloadReport(report: Report, filename?: string): void {
    if (typeof document === 'undefined') return

    const stamp = new Date(report.meta.createdAt).toISOString().replace(/[:.]/g, '-')
    const name = filename ?? `vue-why-render-${stamp}.json`

    const blob = new Blob([serializeReport(report)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = name
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
}
