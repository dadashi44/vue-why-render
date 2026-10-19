import type { Report } from './report'
import { Registry } from './registry'

/**
 * Реестр из сохранённого отчёта — чтобы панель показала чужую сессию теми же
 * вкладками, что и живую, не заводя второй набор выборок.
 *
 * Компоненты в отчёте уже сведены по `file::name`, поэтому здесь каждый ключ —
 * одна запись с условным uid. Связей родитель — ребёнок отчёт не хранит, так
 * что дерево выходит плоским; панель говорит об этом вслух.
 */
export function registryFromReport(report: Report): Registry {
    const registry = new Registry({
        maxEvents: Math.max(1, report.events.length),
        now: () => report.meta.startedAt,
    })

    report.components.forEach((component, index) => {
        const record = registry.register({
            uid: index + 1,
            name: component.name,
            file: component.file,
            parentUid: null,
        })
        record.renderCount = component.renderCount
        record.updateCount = component.updateCount
        record.totalDuration = component.totalDuration
        record.maxDuration = component.maxDuration
        record.lastReasons = component.reasons
        record.lastPropChanges = component.propChanges
    })

    for (const violation of report.violations ?? []) registry.addViolation(violation)

    registry.restore({
        events: report.events,
        totalRenders: report.totals.renders,
        startedAt: report.meta.startedAt,
    })
    return registry
}
