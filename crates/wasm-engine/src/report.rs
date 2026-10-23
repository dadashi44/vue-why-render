use std::collections::HashMap;

use crate::types::{ComponentRecord, Hint, HintOptions, RenderReason, ReportComponent};

/// Stable component key: `file::name` or just `name`.
fn component_key(record: &ComponentRecord) -> String {
    match &record.file {
        Some(f) => format!("{}::{}", f, record.name),
        None => record.name.clone(),
    }
}

/// Aggregate component records by key — the core of createReport().
/// Returns components sorted by renderCount descending, then by key.
pub fn aggregate_components(
    records: Vec<ComponentRecord>,
    hint_options: &HintOptions,
) -> Vec<ReportComponent> {
    let mut by_key: HashMap<String, ReportComponent> = HashMap::new();
    let mut insertion_order: Vec<String> = Vec::new();

    for record in records {
        let key = component_key(&record);

        if let Some(existing) = by_key.get_mut(&key) {
            existing.instances += 1;
            existing.render_count += record.render_count;
            existing.update_count += record.update_count;
            existing.total_duration += record.total_duration;
            if record.max_duration > existing.max_duration {
                existing.max_duration = record.max_duration;
            }

            // Deduplicate reasons by key.
            for reason in record.last_reasons {
                let rk = reason.reason_key();
                if !existing.reasons.iter().any(|r| r.reason_key() == rk) {
                    existing.reasons.push(reason);
                }
            }

            // Deduplicate prop changes by key.
            for change in record.last_prop_changes {
                if !existing
                    .prop_changes
                    .iter()
                    .any(|c| c.key == change.key)
                {
                    existing.prop_changes.push(change);
                }
            }
        } else {
            insertion_order.push(key.clone());
            by_key.insert(
                key.clone(),
                ReportComponent {
                    key,
                    name: record.name,
                    file: record.file,
                    instances: 1,
                    render_count: record.render_count,
                    update_count: record.update_count,
                    total_duration: record.total_duration,
                    max_duration: record.max_duration,
                    reasons: record.last_reasons,
                    prop_changes: record.last_prop_changes,
                    hints: Vec::new(),
                },
            );
        }
    }

    // Generate hints for each aggregated component.
    for component in by_key.values_mut() {
        component.hints = hints_for(component, hint_options);
    }

    // Sort: most renders first, then alphabetically by key.
    let mut components: Vec<ReportComponent> = insertion_order
        .into_iter()
        .filter_map(|k| by_key.remove(&k))
        .collect();

    components.sort_by(|a, b| {
        b.render_count
            .cmp(&a.render_count)
            .then_with(|| a.key.cmp(&b.key))
    });

    components
}

/// Deduplicate reasons: within one tick the same key triggers multiple times.
pub fn dedupe_reasons(reasons: Vec<RenderReason>, limit: usize) -> Vec<RenderReason> {
    let mut seen: HashMap<String, ()> = HashMap::new();
    let mut result = Vec::with_capacity(limit.min(reasons.len()));

    for reason in reasons {
        let id = format!("{}:{}:{}", reason.source, reason.key, reason.kind);
        if seen.contains_key(&id) {
            continue;
        }
        seen.insert(id, ());
        result.push(reason);
        if result.len() >= limit {
            break;
        }
    }

    result
}

/// Generate hints for a component — mirrors TypeScript hintsFor().
fn hints_for(component: &ReportComponent, options: &HintOptions) -> Vec<Hint> {
    let mut hints = Vec::new();
    if component.render_count == 0 {
        return hints;
    }

    if options.track_props {
        let new_ref_keys: Vec<String> = component
            .prop_changes
            .iter()
            .filter(|c| c.reference_only)
            .map(|c| c.key.clone())
            .collect();

        if !new_ref_keys.is_empty() {
            hints.push(Hint {
                code: "newReference".to_string(),
                keys: new_ref_keys,
            });
        }

        let new_fn_keys: Vec<String> = component
            .prop_changes
            .iter()
            .filter(|c| c.new_function)
            .map(|c| c.key.clone())
            .collect();

        if !new_fn_keys.is_empty() {
            hints.push(Hint {
                code: "newFunction".to_string(),
                keys: new_fn_keys,
            });
        }
    }

    if options.track_reasons && component.reasons.iter().any(|r| r.source == "route") {
        hints.push(Hint {
            code: "wholeRoute".to_string(),
            keys: Vec::new(),
        });
    }

    if component.update_count > 0
        && options.track_props
        && options.track_reasons
        && component.reasons.is_empty()
        && component.prop_changes.is_empty()
    {
        hints.push(Hint {
            code: "parentRender".to_string(),
            keys: Vec::new(),
        });
    }

    hints
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{ComponentRecord, PropChange, RenderReason};

    fn make_record(uid: u32, name: &str, file: Option<&str>, renders: u32) -> ComponentRecord {
        ComponentRecord {
            uid,
            name: name.to_string(),
            file: file.map(|s| s.to_string()),
            parent_uid: None,
            mounted_at: 0.0,
            render_count: renders,
            update_count: renders.saturating_sub(1),
            flash_count: 0,
            total_duration: renders as f64 * 2.0,
            max_duration: 5.0,
            last_duration: 2.0,
            last_render_at: 1000.0,
            last_reasons: vec![],
            last_prop_changes: vec![],
        }
    }

    fn make_reason(source: &str, key: &str, kind: &str) -> RenderReason {
        RenderReason {
            kind: kind.to_string(),
            key: key.to_string(),
            source: source.to_string(),
            old_value: None,
            new_value: None,
            store: None,
            action: None,
        }
    }

    fn default_opts() -> HintOptions {
        HintOptions {
            track_props: true,
            track_reasons: true,
        }
    }

    // --- aggregate_components ---

    #[test]
    fn empty_input_returns_empty() {
        let result = aggregate_components(vec![], &default_opts());
        assert!(result.is_empty());
    }

    #[test]
    fn single_record() {
        let result = aggregate_components(vec![make_record(1, "App", Some("app.vue"), 5)], &default_opts());
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].key, "app.vue::App");
        assert_eq!(result[0].instances, 1);
        assert_eq!(result[0].render_count, 5);
    }

    #[test]
    fn aggregates_by_key() {
        let records = vec![
            make_record(1, "Button", Some("ui.vue"), 3),
            make_record(2, "Button", Some("ui.vue"), 7),
            make_record(3, "App", Some("app.vue"), 1),
        ];
        let result = aggregate_components(records, &default_opts());
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].name, "Button");
        assert_eq!(result[0].render_count, 10);
        assert_eq!(result[0].instances, 2);
        assert_eq!(result[1].name, "App");
        assert_eq!(result[1].render_count, 1);
    }

    #[test]
    fn key_without_file_is_just_name() {
        let records = vec![
            make_record(1, "Anonymous", None, 3),
            make_record(2, "Anonymous", None, 2),
        ];
        let result = aggregate_components(records, &default_opts());
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].key, "Anonymous");
        assert_eq!(result[0].instances, 2);
        assert_eq!(result[0].render_count, 5);
    }

    #[test]
    fn same_name_different_files_are_separate() {
        let records = vec![
            make_record(1, "Button", Some("a.vue"), 3),
            make_record(2, "Button", Some("b.vue"), 7),
        ];
        let result = aggregate_components(records, &default_opts());
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn sorted_by_render_count_desc_then_key() {
        let records = vec![
            make_record(1, "C", Some("c.vue"), 5),
            make_record(2, "A", Some("a.vue"), 5), // same count, "a" < "c"
            make_record(3, "B", Some("b.vue"), 10),
        ];
        let result = aggregate_components(records, &default_opts());
        assert_eq!(result[0].name, "B"); // 10
        assert_eq!(result[1].name, "A"); // 5, key a.vue::A < c.vue::C
        assert_eq!(result[2].name, "C"); // 5
    }

    #[test]
    fn duration_aggregation() {
        let mut r1 = make_record(1, "X", Some("x.vue"), 2);
        r1.total_duration = 10.0;
        r1.max_duration = 8.0;

        let mut r2 = make_record(2, "X", Some("x.vue"), 3);
        r2.total_duration = 15.0;
        r2.max_duration = 12.0;

        let result = aggregate_components(vec![r1, r2], &default_opts());
        assert_eq!(result[0].total_duration, 25.0);
        assert_eq!(result[0].max_duration, 12.0);
    }

    #[test]
    fn reasons_deduplicated_across_instances() {
        let mut r1 = make_record(1, "X", Some("x.vue"), 2);
        r1.last_reasons = vec![make_reason("props", "title", "set")];

        let mut r2 = make_record(2, "X", Some("x.vue"), 3);
        r2.last_reasons = vec![
            make_reason("props", "title", "set"),  // duplicate
            make_reason("setup", "count", "set"),   // new
        ];

        let result = aggregate_components(vec![r1, r2], &default_opts());
        assert_eq!(result[0].reasons.len(), 2); // title + count
    }

    #[test]
    fn prop_changes_deduplicated_by_key() {
        let mut r1 = make_record(1, "X", Some("x.vue"), 3);
        r1.last_prop_changes = vec![PropChange {
            key: "style".to_string(),
            old_value: "a".to_string(),
            new_value: "b".to_string(),
            reference_only: false,
            new_function: false,
        }];

        let mut r2 = make_record(2, "X", Some("x.vue"), 3);
        r2.last_prop_changes = vec![PropChange {
            key: "style".to_string(), // same key — should not duplicate
            old_value: "c".to_string(),
            new_value: "d".to_string(),
            reference_only: false,
            new_function: false,
        }];

        let result = aggregate_components(vec![r1, r2], &default_opts());
        assert_eq!(result[0].prop_changes.len(), 1);
    }

    // --- dedupe_reasons ---

    #[test]
    fn dedupe_empty_input() {
        let result = dedupe_reasons(vec![], 10);
        assert!(result.is_empty());
    }

    #[test]
    fn dedupe_all_unique() {
        let reasons = vec![
            make_reason("props", "a", "set"),
            make_reason("setup", "b", "set"),
            make_reason("store", "c", "add"),
        ];
        let result = dedupe_reasons(reasons, 10);
        assert_eq!(result.len(), 3);
    }

    #[test]
    fn dedupe_removes_duplicates() {
        let reasons = vec![
            make_reason("setup", "count", "set"),
            make_reason("setup", "count", "set"),
            make_reason("setup", "name", "set"),
        ];
        let result = dedupe_reasons(reasons, 10);
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn dedupe_respects_limit() {
        let reasons = vec![
            make_reason("a", "1", "set"),
            make_reason("b", "2", "set"),
            make_reason("c", "3", "set"),
            make_reason("d", "4", "set"),
        ];
        let result = dedupe_reasons(reasons, 2);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].source, "a");
        assert_eq!(result[1].source, "b");
    }

    #[test]
    fn dedupe_same_key_different_type_are_separate() {
        // source:key:type is the dedup key — different types are separate.
        let reasons = vec![
            make_reason("setup", "items", "set"),
            make_reason("setup", "items", "add"),
        ];
        let result = dedupe_reasons(reasons, 10);
        assert_eq!(result.len(), 2);
    }

    // --- hints ---

    #[test]
    fn hints_new_reference() {
        let mut record = make_record(1, "Card", Some("card.vue"), 5);
        record.last_prop_changes = vec![PropChange {
            key: "style".to_string(),
            old_value: "{}".to_string(),
            new_value: "{}".to_string(),
            reference_only: true,
            new_function: false,
        }];

        let result = aggregate_components(vec![record], &default_opts());
        assert_eq!(result[0].hints.len(), 1);
        assert_eq!(result[0].hints[0].code, "newReference");
        assert_eq!(result[0].hints[0].keys, vec!["style"]);
    }

    #[test]
    fn hints_new_function() {
        let mut record = make_record(1, "Btn", Some("btn.vue"), 3);
        record.last_prop_changes = vec![PropChange {
            key: "onClick".to_string(),
            old_value: "f()".to_string(),
            new_value: "f()".to_string(),
            reference_only: false,
            new_function: true,
        }];

        let result = aggregate_components(vec![record], &default_opts());
        let codes: Vec<&str> = result[0].hints.iter().map(|h| h.code.as_str()).collect();
        assert!(codes.contains(&"newFunction"));
    }

    #[test]
    fn hints_whole_route() {
        let mut record = make_record(1, "Page", Some("page.vue"), 3);
        record.last_reasons = vec![make_reason("route", "path", "set")];

        let result = aggregate_components(vec![record], &default_opts());
        let codes: Vec<&str> = result[0].hints.iter().map(|h| h.code.as_str()).collect();
        assert!(codes.contains(&"wholeRoute"));
    }

    #[test]
    fn hints_parent_render() {
        // No reasons, no prop changes, but has updates → parent render.
        let record = make_record(1, "Leaf", Some("leaf.vue"), 5);
        // update_count = 4 (renders - 1), reasons empty, prop_changes empty

        let result = aggregate_components(vec![record], &default_opts());
        let codes: Vec<&str> = result[0].hints.iter().map(|h| h.code.as_str()).collect();
        assert!(codes.contains(&"parentRender"));
    }

    #[test]
    fn hints_no_parent_render_if_mount_only() {
        // render_count=1, update_count=0 → just a mount, not a parent render.
        let record = make_record(1, "Leaf", Some("leaf.vue"), 1);
        let result = aggregate_components(vec![record], &default_opts());
        let codes: Vec<&str> = result[0].hints.iter().map(|h| h.code.as_str()).collect();
        assert!(!codes.contains(&"parentRender"));
    }

    #[test]
    fn hints_skipped_when_track_props_false() {
        let mut record = make_record(1, "Card", Some("card.vue"), 5);
        record.last_prop_changes = vec![PropChange {
            key: "style".to_string(),
            old_value: "{}".to_string(),
            new_value: "{}".to_string(),
            reference_only: true,
            new_function: false,
        }];

        let opts = HintOptions {
            track_props: false,
            track_reasons: true,
        };
        let result = aggregate_components(vec![record], &opts);
        assert!(result[0].hints.is_empty());
    }

    #[test]
    fn hints_no_parent_render_without_both_tracking() {
        let record = make_record(1, "Leaf", Some("leaf.vue"), 5);

        let opts = HintOptions {
            track_props: true,
            track_reasons: false,
        };
        let result = aggregate_components(vec![record], &opts);
        let codes: Vec<&str> = result[0].hints.iter().map(|h| h.code.as_str()).collect();
        // Can't conclude parentRender without trackReasons.
        assert!(!codes.contains(&"parentRender"));
    }

    #[test]
    fn zero_renders_no_hints() {
        let record = make_record(1, "Ghost", Some("ghost.vue"), 0);
        let result = aggregate_components(vec![record], &default_opts());
        assert!(result[0].hints.is_empty());
    }
}
