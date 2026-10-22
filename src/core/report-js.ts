/**
 * Pure JS report aggregation — extracted from createReport() for use as WASM fallback.
 */
import type { ComponentRecord, ResolvedOptions } from '../types'
import type { ReportComponent } from './report'
import { componentKey, reasonKey } from './report'
import { hintsFor } from './hints'

export function aggregate_components_js(
    records: ComponentRecord[],
    options: Pick<ResolvedOptions, 'trackProps' | 'trackReasons'>,
): ReportComponent[] {
    const byKey = new Map<string, ReportComponent>()
    for (const record of records) {
        const key = componentKey(record)
        const existing = byKey.get(key)
        if (existing) {
            existing.instances++
            existing.renderCount += record.renderCount
            existing.updateCount += record.updateCount
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
            updateCount: record.updateCount,
            totalDuration: record.totalDuration,
            maxDuration: record.maxDuration,
            reasons: [...record.lastReasons],
            propChanges: [...record.lastPropChanges],
            hints: [],
        })
    }

    for (const component of byKey.values()) {
        component.hints = hintsFor(component, options)
    }

    return [...byKey.values()].sort((a, b) =>
        b.renderCount - a.renderCount || a.key.localeCompare(b.key))
}
