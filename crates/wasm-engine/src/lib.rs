mod diff;
mod report;
mod tree;
mod types;

use wasm_bindgen::prelude::*;

/// Build component tree from flat records.
/// Input: JS array of ComponentRecord objects.
/// Output: JS array of TreeNode objects (with children, depth, subtreeRenders).
#[wasm_bindgen(js_name = "buildTree")]
pub fn build_tree(records_js: JsValue) -> Result<JsValue, JsValue> {
    let records: Vec<types::ComponentRecord> = serde_wasm_bindgen::from_value(records_js)
        .map_err(|e| JsValue::from_str(&format!("buildTree: {}", e)))?;

    let tree = tree::build_tree(records);

    serde_wasm_bindgen::to_value(&tree).map_err(|e| JsValue::from_str(&format!("buildTree serialize: {}", e)))
}

/// Aggregate component records by file::name key.
/// Input: JS array of ComponentRecord, hint options { trackProps, trackReasons }.
/// Output: JS array of ReportComponent (sorted by renderCount desc).
#[wasm_bindgen(js_name = "aggregateComponents")]
pub fn aggregate_components(records_js: JsValue, options_js: JsValue) -> Result<JsValue, JsValue> {
    let records: Vec<types::ComponentRecord> = serde_wasm_bindgen::from_value(records_js)
        .map_err(|e| JsValue::from_str(&format!("aggregateComponents: {}", e)))?;

    let options: types::HintOptions = serde_wasm_bindgen::from_value(options_js)
        .map_err(|e| JsValue::from_str(&format!("aggregateComponents options: {}", e)))?;

    let components = report::aggregate_components(records, &options);

    serde_wasm_bindgen::to_value(&components)
        .map_err(|e| JsValue::from_str(&format!("aggregateComponents serialize: {}", e)))
}

/// Deduplicate render reasons within a tick.
/// Input: JS array of RenderReason, limit number.
/// Output: JS array of deduplicated RenderReason.
#[wasm_bindgen(js_name = "dedupeReasons")]
pub fn dedupe_reasons(reasons_js: JsValue, limit: usize) -> Result<JsValue, JsValue> {
    let reasons: Vec<types::RenderReason> = serde_wasm_bindgen::from_value(reasons_js)
        .map_err(|e| JsValue::from_str(&format!("dedupeReasons: {}", e)))?;

    let result = report::dedupe_reasons(reasons, limit);

    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("dedupeReasons serialize: {}", e)))
}

/// Compare two reports.
/// Input: two Report-like JS objects (must have meta, totals, components).
/// Output: ReportDiff JS object.
#[wasm_bindgen(js_name = "diffReports")]
pub fn diff_reports(before_js: JsValue, after_js: JsValue) -> Result<JsValue, JsValue> {
    let before: types::ReportForDiff = serde_wasm_bindgen::from_value(before_js)
        .map_err(|e| JsValue::from_str(&format!("diffReports before: {}", e)))?;

    let after: types::ReportForDiff = serde_wasm_bindgen::from_value(after_js)
        .map_err(|e| JsValue::from_str(&format!("diffReports after: {}", e)))?;

    let result = diff::diff_reports(before, after);

    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("diffReports serialize: {}", e)))
}

/// Return the WASM engine version — used to verify the module loaded.
#[wasm_bindgen(js_name = "engineVersion")]
pub fn engine_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
