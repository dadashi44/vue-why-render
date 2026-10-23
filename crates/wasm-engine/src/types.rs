use serde::{Deserialize, Serialize};

/// Mirror of TypeScript RenderReason.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderReason {
    #[serde(rename = "type")]
    pub kind: String,
    pub key: String,
    pub source: String,
    #[serde(rename = "oldValue", skip_serializing_if = "Option::is_none")]
    pub old_value: Option<String>,
    #[serde(rename = "newValue", skip_serializing_if = "Option::is_none")]
    pub new_value: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub store: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action: Option<String>,
}

impl RenderReason {
    pub fn reason_key(&self) -> String {
        format!("{}:{}", self.source, self.key)
    }
}

/// Mirror of TypeScript PropChange.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PropChange {
    pub key: String,
    #[serde(rename = "oldValue")]
    pub old_value: String,
    #[serde(rename = "newValue")]
    pub new_value: String,
    #[serde(rename = "referenceOnly")]
    pub reference_only: bool,
    #[serde(rename = "newFunction")]
    pub new_function: bool,
}

/// Mirror of TypeScript ComponentRecord.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentRecord {
    pub uid: u32,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file: Option<String>,
    #[serde(rename = "parentUid")]
    pub parent_uid: Option<u32>,
    #[serde(rename = "mountedAt")]
    pub mounted_at: f64,
    #[serde(rename = "renderCount")]
    pub render_count: u32,
    #[serde(rename = "updateCount")]
    pub update_count: u32,
    #[serde(rename = "flashCount")]
    pub flash_count: u32,
    #[serde(rename = "totalDuration")]
    pub total_duration: f64,
    #[serde(rename = "maxDuration")]
    pub max_duration: f64,
    #[serde(rename = "lastDuration")]
    pub last_duration: f64,
    #[serde(rename = "lastRenderAt")]
    pub last_render_at: f64,
    #[serde(rename = "lastReasons")]
    pub last_reasons: Vec<RenderReason>,
    #[serde(rename = "lastPropChanges")]
    pub last_prop_changes: Vec<PropChange>,
}

/// Output of tree building — mirrors TypeScript TreeNode.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreeNode {
    pub uid: u32,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file: Option<String>,
    #[serde(rename = "parentUid")]
    pub parent_uid: Option<u32>,
    #[serde(rename = "mountedAt")]
    pub mounted_at: f64,
    #[serde(rename = "renderCount")]
    pub render_count: u32,
    #[serde(rename = "updateCount")]
    pub update_count: u32,
    #[serde(rename = "flashCount")]
    pub flash_count: u32,
    #[serde(rename = "totalDuration")]
    pub total_duration: f64,
    #[serde(rename = "maxDuration")]
    pub max_duration: f64,
    #[serde(rename = "lastDuration")]
    pub last_duration: f64,
    #[serde(rename = "lastRenderAt")]
    pub last_render_at: f64,
    #[serde(rename = "lastReasons")]
    pub last_reasons: Vec<RenderReason>,
    #[serde(rename = "lastPropChanges")]
    pub last_prop_changes: Vec<PropChange>,
    pub children: Vec<TreeNode>,
    #[serde(rename = "subtreeRenders")]
    pub subtree_renders: u32,
    pub depth: u32,
}

/// Hint codes matching TypeScript HintCode.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hint {
    pub code: String,
    pub keys: Vec<String>,
}

/// Aggregated component in a report — mirrors TypeScript ReportComponent.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportComponent {
    pub key: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file: Option<String>,
    pub instances: u32,
    #[serde(rename = "renderCount")]
    pub render_count: u32,
    #[serde(rename = "updateCount")]
    pub update_count: u32,
    #[serde(rename = "totalDuration")]
    pub total_duration: f64,
    #[serde(rename = "maxDuration")]
    pub max_duration: f64,
    pub reasons: Vec<RenderReason>,
    #[serde(rename = "propChanges")]
    pub prop_changes: Vec<PropChange>,
    pub hints: Vec<Hint>,
}

/// Diff status for component comparison.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DiffStatus {
    #[serde(rename = "improved")]
    Improved,
    #[serde(rename = "regressed")]
    Regressed,
    #[serde(rename = "unchanged")]
    Unchanged,
    #[serde(rename = "added")]
    Added,
    #[serde(rename = "removed")]
    Removed,
}

/// Per-component diff result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentDiff {
    pub key: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file: Option<String>,
    pub status: DiffStatus,
    pub before: u32,
    pub after: u32,
    pub delta: i32,
    #[serde(rename = "deltaRatio")]
    pub delta_ratio: Option<f64>,
    #[serde(rename = "beforePerSecond")]
    pub before_per_second: f64,
    #[serde(rename = "afterPerSecond")]
    pub after_per_second: f64,
    #[serde(rename = "reasonsGone")]
    pub reasons_gone: Vec<String>,
    #[serde(rename = "reasonsNew")]
    pub reasons_new: Vec<String>,
}

/// Full diff result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportDiff {
    pub warnings: Vec<String>,
    pub totals: DiffTotals,
    pub components: Vec<ComponentDiff>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffTotals {
    pub before: u32,
    pub after: u32,
    pub delta: i32,
    #[serde(rename = "deltaRatio")]
    pub delta_ratio: Option<f64>,
    #[serde(rename = "beforePerSecond")]
    pub before_per_second: f64,
    #[serde(rename = "afterPerSecond")]
    pub after_per_second: f64,
}

/// Report totals.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportTotals {
    pub renders: u32,
    #[serde(rename = "rendersPerSecond")]
    pub renders_per_second: f64,
}

/// Minimal report shape for diffing — only the fields we need.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportForDiff {
    pub meta: ReportMeta,
    pub totals: ReportTotals,
    pub components: Vec<ReportComponent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportMeta {
    pub format: u32,
    pub package: String,
    #[serde(rename = "durationMs")]
    pub duration_ms: f64,
    pub options: ReportOptionsForDiff,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportOptionsForDiff {
    #[serde(rename = "includeMounts")]
    pub include_mounts: bool,
    #[serde(rename = "trackReasons")]
    pub track_reasons: bool,
    #[serde(rename = "trackProps")]
    pub track_props: bool,
    #[serde(rename = "minDuration")]
    pub min_duration: f64,
    pub include: Vec<String>,
    pub exclude: Vec<String>,
    #[serde(rename = "sampleRate", skip_serializing_if = "Option::is_none")]
    pub sample_rate: Option<f64>,
}

/// Options relevant to hint generation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HintOptions {
    #[serde(rename = "trackProps")]
    pub track_props: bool,
    #[serde(rename = "trackReasons")]
    pub track_reasons: bool,
}
