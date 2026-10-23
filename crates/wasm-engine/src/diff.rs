use std::collections::{HashMap, HashSet};

use crate::types::{
    ComponentDiff, DiffStatus, DiffTotals, RenderReason, ReportComponent, ReportDiff,
    ReportForDiff, ReportOptionsForDiff,
};

const DURATION_TOLERANCE: f64 = 0.25;
const REPORT_FORMAT: u32 = 1;

fn ratio(before: u32, after: u32) -> Option<f64> {
    if before == 0 {
        return None;
    }
    Some((after as f64 - before as f64) / before as f64)
}

fn per_second(count: u32, duration_ms: f64) -> f64 {
    count as f64 / (duration_ms / 1000.0).max(0.001)
}

fn same_filters(a: &[String], b: &[String]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut left: Vec<&str> = a.iter().map(|s| s.as_str()).collect();
    let mut right: Vec<&str> = b.iter().map(|s| s.as_str()).collect();
    left.sort();
    right.sort();
    left == right
}

fn option_warnings(before: &ReportOptionsForDiff, after: &ReportOptionsForDiff) -> Vec<String> {
    let mut out = Vec::new();

    if before.include_mounts != after.include_mounts {
        out.push(format!(
            "includeMounts differs ({} \u{2192} {}): mounts are counted in one report and not the other",
            before.include_mounts, after.include_mounts
        ));
    }
    if (before.min_duration - after.min_duration).abs() > f64::EPSILON {
        out.push(format!(
            "minDuration differs ({} \u{2192} {}ms): the reports drop a different set of fast updates",
            before.min_duration, after.min_duration
        ));
    }
    if !same_filters(&before.include, &after.include)
        || !same_filters(&before.exclude, &after.exclude)
    {
        out.push(
            "include/exclude differ: the reports watch different sets of components".to_string(),
        );
    }
    let before_rate = before.sample_rate.unwrap_or(1.0);
    let after_rate = after.sample_rate.unwrap_or(1.0);
    if (before_rate - after_rate).abs() > f64::EPSILON {
        out.push(format!(
            "sampleRate differs ({} \u{2192} {}): the reports record a different share of renders, raw counts are not comparable",
            before_rate, after_rate
        ));
    }
    if before.track_reasons != after.track_reasons {
        out.push(format!(
            "trackReasons differs ({} \u{2192} {}): reasons are missing from one side",
            before.track_reasons, after.track_reasons
        ));
    }
    if before.track_props != after.track_props {
        out.push(format!(
            "trackProps differs ({} \u{2192} {}): prop changes are missing from one side",
            before.track_props, after.track_props
        ));
    }

    out
}

fn reason_key(reason: &RenderReason) -> String {
    format!("{}:{}", reason.source, reason.key)
}

fn status_of(before: u32, after: u32, existed_before: bool, exists_after: bool) -> DiffStatus {
    if !existed_before {
        return DiffStatus::Added;
    }
    if !exists_after {
        return DiffStatus::Removed;
    }
    if after < before {
        return DiffStatus::Improved;
    }
    if after > before {
        return DiffStatus::Regressed;
    }
    DiffStatus::Unchanged
}

fn status_order(status: &DiffStatus) -> u8 {
    match status {
        DiffStatus::Regressed => 0,
        DiffStatus::Added => 1,
        DiffStatus::Improved => 2,
        DiffStatus::Unchanged => 3,
        DiffStatus::Removed => 4,
    }
}

/// Compare two reports — mirrors TypeScript diffReports().
pub fn diff_reports(before: ReportForDiff, after: ReportForDiff) -> ReportDiff {
    let mut warnings = Vec::new();

    if before.meta.format != after.meta.format {
        warnings.push(format!(
            "report formats differ ({} \u{2192} {})",
            before.meta.format, after.meta.format
        ));
    }
    if before.meta.format > REPORT_FORMAT || after.meta.format > REPORT_FORMAT {
        warnings.push(format!(
            "report format is newer than supported ({})",
            REPORT_FORMAT
        ));
    }
    if before.meta.package != after.meta.package {
        warnings.push(format!(
            "captured by different versions of vue-why-render ({} \u{2192} {})",
            before.meta.package, after.meta.package
        ));
    }

    let longest = before.meta.duration_ms.max(after.meta.duration_ms);
    let shortest = before.meta.duration_ms.min(after.meta.duration_ms);
    if longest > 0.0 && (longest - shortest) / longest > DURATION_TOLERANCE {
        warnings.push(format!(
            "sessions differ in length ({}ms \u{2192} {}ms): compare the per-second numbers, not the raw counts",
            before.meta.duration_ms.round(), after.meta.duration_ms.round()
        ));
    }

    warnings.extend(option_warnings(&before.meta.options, &after.meta.options));

    let before_by_key: HashMap<&str, &ReportComponent> = before
        .components
        .iter()
        .map(|c| (c.key.as_str(), c))
        .collect();
    let after_by_key: HashMap<&str, &ReportComponent> = after
        .components
        .iter()
        .map(|c| (c.key.as_str(), c))
        .collect();

    let mut keys: HashSet<&str> = HashSet::new();
    for k in before_by_key.keys() {
        keys.insert(k);
    }
    for k in after_by_key.keys() {
        keys.insert(k);
    }

    let mut components: Vec<ComponentDiff> = Vec::with_capacity(keys.len());
    for key in keys {
        let left = before_by_key.get(key).copied();
        let right = after_by_key.get(key).copied();
        let source = right.or(left).unwrap();

        let before_count = left.map(|c| c.render_count).unwrap_or(0);
        let after_count = right.map(|c| c.render_count).unwrap_or(0);

        let before_reasons: HashSet<String> = left
            .map(|c| c.reasons.iter().map(reason_key).collect())
            .unwrap_or_default();
        let after_reasons: HashSet<String> = right
            .map(|c| c.reasons.iter().map(reason_key).collect())
            .unwrap_or_default();

        components.push(ComponentDiff {
            key: key.to_string(),
            name: source.name.clone(),
            file: source.file.clone(),
            status: status_of(before_count, after_count, left.is_some(), right.is_some()),
            before: before_count,
            after: after_count,
            delta: after_count as i32 - before_count as i32,
            delta_ratio: ratio(before_count, after_count),
            before_per_second: per_second(before_count, before.meta.duration_ms),
            after_per_second: per_second(after_count, after.meta.duration_ms),
            reasons_gone: before_reasons
                .iter()
                .filter(|r| !after_reasons.contains(*r))
                .cloned()
                .collect(),
            reasons_new: after_reasons
                .iter()
                .filter(|r| !before_reasons.contains(*r))
                .cloned()
                .collect(),
        });
    }

    components.sort_by(|a, b| {
        status_order(&a.status)
            .cmp(&status_order(&b.status))
            .then_with(|| {
                b.delta
                    .unsigned_abs()
                    .cmp(&a.delta.unsigned_abs())
            })
            .then_with(|| a.key.cmp(&b.key))
    });

    let before_renders = before.totals.renders;
    let after_renders = after.totals.renders;

    ReportDiff {
        warnings,
        totals: DiffTotals {
            before: before_renders,
            after: after_renders,
            delta: after_renders as i32 - before_renders as i32,
            delta_ratio: ratio(before_renders, after_renders),
            before_per_second: before.totals.renders_per_second,
            after_per_second: after.totals.renders_per_second,
        },
        components,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::*;

    fn make_meta(format: u32, pkg: &str, duration_ms: f64) -> ReportMeta {
        ReportMeta {
            format,
            package: pkg.to_string(),
            duration_ms,
            options: ReportOptionsForDiff {
                include_mounts: false,
                track_reasons: true,
                track_props: true,
                min_duration: 0.0,
                include: vec![],
                exclude: vec![],
                sample_rate: None,
            },
        }
    }

    fn make_component(key: &str, name: &str, renders: u32) -> ReportComponent {
        ReportComponent {
            key: key.to_string(),
            name: name.to_string(),
            file: None,
            instances: 1,
            render_count: renders,
            update_count: renders,
            total_duration: 0.0,
            max_duration: 0.0,
            reasons: vec![],
            prop_changes: vec![],
            hints: vec![],
        }
    }

    fn make_component_with_reasons(
        key: &str,
        name: &str,
        renders: u32,
        reasons: Vec<(&str, &str)>,
    ) -> ReportComponent {
        let mut c = make_component(key, name, renders);
        c.reasons = reasons
            .into_iter()
            .map(|(source, rkey)| RenderReason {
                kind: "set".to_string(),
                key: rkey.to_string(),
                source: source.to_string(),
                old_value: None,
                new_value: None,
                store: None,
                action: None,
            })
            .collect();
        c
    }

    fn make_report(meta: ReportMeta, renders: u32, components: Vec<ReportComponent>) -> ReportForDiff {
        let rps = renders as f64 / (meta.duration_ms / 1000.0).max(0.001);
        ReportForDiff {
            meta,
            totals: ReportTotals {
                renders,
                renders_per_second: rps,
            },
            components,
        }
    }

    // --- Basic diff ---

    #[test]
    fn empty_reports() {
        let diff = diff_reports(
            make_report(make_meta(1, "0.6.0", 5000.0), 0, vec![]),
            make_report(make_meta(1, "0.6.0", 5000.0), 0, vec![]),
        );
        assert!(diff.components.is_empty());
        assert!(diff.warnings.is_empty());
        assert_eq!(diff.totals.delta, 0);
    }

    #[test]
    fn diff_detects_regression_and_improvement() {
        let before = make_report(
            make_meta(1, "0.6.0", 5000.0),
            20,
            vec![
                make_component("a.vue::A", "A", 10),
                make_component("b.vue::B", "B", 10),
            ],
        );
        let after = make_report(
            make_meta(1, "0.6.0", 5000.0),
            25,
            vec![
                make_component("a.vue::A", "A", 20),
                make_component("b.vue::B", "B", 5),
            ],
        );

        let diff = diff_reports(before, after);
        assert_eq!(diff.components.len(), 2);
        assert_eq!(diff.components[0].name, "A");
        assert!(matches!(diff.components[0].status, DiffStatus::Regressed));
        assert_eq!(diff.components[0].delta, 10);

        assert_eq!(diff.components[1].name, "B");
        assert!(matches!(diff.components[1].status, DiffStatus::Improved));
        assert_eq!(diff.components[1].delta, -5);
    }

    #[test]
    fn added_component() {
        let before = make_report(
            make_meta(1, "0.6.0", 5000.0),
            5,
            vec![make_component("a.vue::A", "A", 5)],
        );
        let after = make_report(
            make_meta(1, "0.6.0", 5000.0),
            15,
            vec![
                make_component("a.vue::A", "A", 5),
                make_component("b.vue::B", "B", 10), // new
            ],
        );

        let diff = diff_reports(before, after);
        let added = diff.components.iter().find(|c| c.name == "B").unwrap();
        assert!(matches!(added.status, DiffStatus::Added));
        assert_eq!(added.before, 0);
        assert_eq!(added.after, 10);
    }

    #[test]
    fn removed_component() {
        let before = make_report(
            make_meta(1, "0.6.0", 5000.0),
            15,
            vec![
                make_component("a.vue::A", "A", 5),
                make_component("b.vue::B", "B", 10),
            ],
        );
        let after = make_report(
            make_meta(1, "0.6.0", 5000.0),
            5,
            vec![make_component("a.vue::A", "A", 5)],
        );

        let diff = diff_reports(before, after);
        let removed = diff.components.iter().find(|c| c.name == "B").unwrap();
        assert!(matches!(removed.status, DiffStatus::Removed));
        assert_eq!(removed.before, 10);
        assert_eq!(removed.after, 0);
    }

    #[test]
    fn unchanged_component() {
        let before = make_report(
            make_meta(1, "0.6.0", 5000.0),
            5,
            vec![make_component("a.vue::A", "A", 5)],
        );
        let after = make_report(
            make_meta(1, "0.6.0", 5000.0),
            5,
            vec![make_component("a.vue::A", "A", 5)],
        );

        let diff = diff_reports(before, after);
        assert_eq!(diff.components.len(), 1);
        assert!(matches!(diff.components[0].status, DiffStatus::Unchanged));
        assert_eq!(diff.components[0].delta, 0);
    }

    // --- Sort order ---

    #[test]
    fn sort_order_regressed_first_then_added_improved_unchanged_removed() {
        let before = make_report(
            make_meta(1, "0.6.0", 5000.0),
            30,
            vec![
                make_component("a.vue::A", "A", 10),   // will be unchanged
                make_component("b.vue::B", "B", 10),   // will be improved
                make_component("c.vue::C", "C", 5),    // will be regressed
                make_component("d.vue::D", "D", 5),    // will be removed
            ],
        );
        let after = make_report(
            make_meta(1, "0.6.0", 5000.0),
            40,
            vec![
                make_component("a.vue::A", "A", 10),   // unchanged
                make_component("b.vue::B", "B", 3),    // improved
                make_component("c.vue::C", "C", 20),   // regressed
                make_component("e.vue::E", "E", 7),    // added
            ],
        );

        let diff = diff_reports(before, after);
        let statuses: Vec<&str> = diff
            .components
            .iter()
            .map(|c| match c.status {
                DiffStatus::Regressed => "regressed",
                DiffStatus::Added => "added",
                DiffStatus::Improved => "improved",
                DiffStatus::Unchanged => "unchanged",
                DiffStatus::Removed => "removed",
            })
            .collect();
        assert_eq!(
            statuses,
            vec!["regressed", "added", "improved", "unchanged", "removed"]
        );
    }

    // --- Ratio ---

    #[test]
    fn ratio_is_null_when_before_is_zero() {
        let before = make_report(
            make_meta(1, "0.6.0", 5000.0),
            0,
            vec![],
        );
        let after = make_report(
            make_meta(1, "0.6.0", 5000.0),
            10,
            vec![make_component("a.vue::A", "A", 10)],
        );

        let diff = diff_reports(before, after);
        assert!(diff.totals.delta_ratio.is_none());
    }

    #[test]
    fn ratio_calculation() {
        let before = make_report(
            make_meta(1, "0.6.0", 5000.0),
            10,
            vec![make_component("a.vue::A", "A", 10)],
        );
        let after = make_report(
            make_meta(1, "0.6.0", 5000.0),
            15,
            vec![make_component("a.vue::A", "A", 15)],
        );

        let diff = diff_reports(before, after);
        let r = diff.totals.delta_ratio.unwrap();
        assert!((r - 0.5).abs() < 0.001); // (15-10)/10 = 0.5
    }

    // --- Reasons tracking ---

    #[test]
    fn tracks_new_and_gone_reasons() {
        let before = make_report(
            make_meta(1, "0.6.0", 5000.0),
            10,
            vec![make_component_with_reasons(
                "a.vue::A",
                "A",
                10,
                vec![("props", "title"), ("setup", "count")],
            )],
        );
        let after = make_report(
            make_meta(1, "0.6.0", 5000.0),
            10,
            vec![make_component_with_reasons(
                "a.vue::A",
                "A",
                10,
                vec![("props", "title"), ("store", "cart")], // count gone, cart new
            )],
        );

        let diff = diff_reports(before, after);
        let comp = &diff.components[0];
        assert!(comp.reasons_gone.contains(&"setup:count".to_string()));
        assert!(comp.reasons_new.contains(&"store:cart".to_string()));
        assert!(!comp.reasons_gone.contains(&"props:title".to_string())); // still present
    }

    // --- Warnings ---

    #[test]
    fn warns_on_include_mounts_mismatch() {
        let mut before = make_report(make_meta(1, "0.6.0", 5000.0), 0, vec![]);
        before.meta.options.include_mounts = true;
        let after = make_report(make_meta(1, "0.6.0", 5000.0), 0, vec![]);

        let diff = diff_reports(before, after);
        assert!(diff.warnings.iter().any(|w| w.contains("includeMounts")));
    }

    #[test]
    fn warns_on_min_duration_mismatch() {
        let mut before = make_report(make_meta(1, "0.6.0", 5000.0), 0, vec![]);
        before.meta.options.min_duration = 5.0;
        let after = make_report(make_meta(1, "0.6.0", 5000.0), 0, vec![]);

        let diff = diff_reports(before, after);
        assert!(diff.warnings.iter().any(|w| w.contains("minDuration")));
    }

    #[test]
    fn warns_on_sample_rate_mismatch() {
        let mut before = make_report(make_meta(1, "0.6.0", 5000.0), 0, vec![]);
        before.meta.options.sample_rate = Some(0.5);
        let after = make_report(make_meta(1, "0.6.0", 5000.0), 0, vec![]);
        // after has None → defaults to 1.0

        let diff = diff_reports(before, after);
        assert!(diff.warnings.iter().any(|w| w.contains("sampleRate")));
    }

    #[test]
    fn warns_on_filter_mismatch() {
        let mut before = make_report(make_meta(1, "0.6.0", 5000.0), 0, vec![]);
        before.meta.options.include = vec!["Button".to_string()];
        let after = make_report(make_meta(1, "0.6.0", 5000.0), 0, vec![]);

        let diff = diff_reports(before, after);
        assert!(diff.warnings.iter().any(|w| w.contains("include/exclude")));
    }

    #[test]
    fn warns_on_track_reasons_mismatch() {
        let mut before = make_report(make_meta(1, "0.6.0", 5000.0), 0, vec![]);
        before.meta.options.track_reasons = false;
        let after = make_report(make_meta(1, "0.6.0", 5000.0), 0, vec![]);

        let diff = diff_reports(before, after);
        assert!(diff.warnings.iter().any(|w| w.contains("trackReasons")));
    }

    #[test]
    fn warns_on_duration_tolerance() {
        let before = make_report(make_meta(1, "0.6.0", 1000.0), 10, vec![]);
        let after = make_report(make_meta(1, "0.6.0", 5000.0), 10, vec![]);

        let diff = diff_reports(before, after);
        assert!(diff.warnings.iter().any(|w| w.contains("sessions differ in length")));
    }

    #[test]
    fn no_duration_warning_within_tolerance() {
        let before = make_report(make_meta(1, "0.6.0", 4000.0), 10, vec![]);
        let after = make_report(make_meta(1, "0.6.0", 5000.0), 10, vec![]);
        // (5000-4000)/5000 = 0.2, tolerance is 0.25

        let diff = diff_reports(before, after);
        assert!(!diff.warnings.iter().any(|w| w.contains("sessions differ")));
    }

    #[test]
    fn warns_on_format_mismatch() {
        let before = make_report(make_meta(1, "0.6.0", 5000.0), 0, vec![]);
        let after = make_report(make_meta(2, "0.7.0", 5000.0), 0, vec![]);

        let diff = diff_reports(before, after);
        assert!(diff.warnings.iter().any(|w| w.contains("report formats differ")));
        assert!(diff.warnings.iter().any(|w| w.contains("newer than supported")));
    }

    #[test]
    fn warns_on_package_version_mismatch() {
        let before = make_report(make_meta(1, "0.5.0", 5000.0), 0, vec![]);
        let after = make_report(make_meta(1, "0.6.0", 5000.0), 0, vec![]);

        let diff = diff_reports(before, after);
        assert!(diff.warnings.iter().any(|w| w.contains("different versions")));
    }

    #[test]
    fn no_warnings_on_identical_options() {
        let before = make_report(make_meta(1, "0.6.0", 5000.0), 10, vec![]);
        let after = make_report(make_meta(1, "0.6.0", 5000.0), 10, vec![]);

        let diff = diff_reports(before, after);
        assert!(diff.warnings.is_empty());
    }

    // --- Per-second normalization ---

    #[test]
    fn per_second_values() {
        let before = make_report(
            make_meta(1, "0.6.0", 2000.0), // 2 seconds
            20,
            vec![make_component("a.vue::A", "A", 20)],
        );
        let after = make_report(
            make_meta(1, "0.6.0", 4000.0), // 4 seconds
            20,
            vec![make_component("a.vue::A", "A", 20)],
        );

        let diff = diff_reports(before, after);
        let comp = &diff.components[0];
        assert!((comp.before_per_second - 10.0).abs() < 0.01); // 20 / 2s
        assert!((comp.after_per_second - 5.0).abs() < 0.01);   // 20 / 4s
    }
}
