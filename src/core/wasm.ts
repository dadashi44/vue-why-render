/**
 * WASM engine loader with fallback to pure JS.
 *
 * The WASM binary is inlined as base64 at build time — no network fetch needed.
 * If the WASM files are missing (dev, test) or initialization fails (SSR, jsdom),
 * all functions silently fall back to the JS implementations.
 */

import type { ComponentRecord, RenderReason, ResolvedOptions } from '../types'
import type { TreeNode } from './registry'
import type { ReportComponent } from './report'
import type { ReportDiff } from './diff'
import type { Report } from './report'
import { build_tree_js } from './tree-js'
import { aggregate_components_js } from './report-js'
import { dedupe_reasons_js } from './reason-js'
import { diff_reports_js } from './diff-js'

// WASM module state.
let wasmReady = false
let wasmFailed = false
let wasmLoading: Promise<boolean> | null = null

// WASM function references — set after successful init.
let wBuildTree: ((records: unknown) => unknown) | null = null
let wAggregateComponents: ((records: unknown, options: unknown) => unknown) | null = null
let wDedupeReasons: ((reasons: unknown, limit: number) => unknown) | null = null
let wDiffReports: ((before: unknown, after: unknown) => unknown) | null = null
let wEngineVersion: (() => string) | null = null

/**
 * Start loading the WASM engine in the background.
 * Returns a promise that resolves to true if WASM is available.
 * Safe to call multiple times — subsequent calls return the same promise.
 */
export function loadWasm(): Promise<boolean> {
    if (wasmReady) return Promise.resolve(true)
    if (wasmFailed) return Promise.resolve(false)
    if (wasmLoading) return wasmLoading

    wasmLoading = (async () => {
        try {
            const inlinePath = '../wasm/inline.js'
            const wasmPath = '../wasm/pkg/vue_why_render_wasm.js'
            const [{ getWasmBytes }, wasm] = await Promise.all([
                import(/* @vite-ignore */ inlinePath),
                import(/* @vite-ignore */ wasmPath),
            ])

            ;(wasm.initSync as (init: { module: BufferSource }) => void)({ module: getWasmBytes().buffer as ArrayBuffer })

            wBuildTree = wasm.buildTree
            wAggregateComponents = wasm.aggregateComponents
            wDedupeReasons = wasm.dedupeReasons
            wDiffReports = wasm.diffReports
            wEngineVersion = wasm.engineVersion
            wasmReady = true
            return true
        }
        catch {
            wasmFailed = true
            return false
        }
    })()

    return wasmLoading
}

/** Check if WASM engine is loaded and ready. */
export function isWasmReady(): boolean {
    return wasmReady
}

/** Get WASM engine version, or null if not loaded. */
export function wasmVersion(): string | null {
    return wEngineVersion?.() ?? null
}

// --- Public API: WASM with JS fallback ---

/**
 * Build component tree. Uses WASM if available, JS otherwise.
 */
export function buildTree(records: ComponentRecord[]): TreeNode[] {
    if (wBuildTree) {
        try {
            return wBuildTree(records) as TreeNode[]
        }
        catch {
            // fallback on any WASM error
        }
    }
    return build_tree_js(records)
}

/**
 * Aggregate records into report components. Uses WASM if available.
 */
export function aggregateComponents(
    records: ComponentRecord[],
    options: Pick<ResolvedOptions, 'trackProps' | 'trackReasons'>,
): ReportComponent[] {
    if (wAggregateComponents) {
        try {
            return wAggregateComponents(records, options) as ReportComponent[]
        }
        catch {
            // fallback
        }
    }
    return aggregate_components_js(records, options)
}

/**
 * Deduplicate render reasons. Uses WASM if available.
 */
export function dedupeReasons(reasons: RenderReason[], limit = 10): RenderReason[] {
    if (wDedupeReasons) {
        try {
            return wDedupeReasons(reasons, limit) as RenderReason[]
        }
        catch {
            // fallback
        }
    }
    return dedupe_reasons_js(reasons, limit)
}

/**
 * Diff two reports. Uses WASM if available.
 */
export function diffReports(before: Report, after: Report): ReportDiff {
    if (wDiffReports) {
        try {
            return wDiffReports(before, after) as ReportDiff
        }
        catch {
            // fallback
        }
    }
    return diff_reports_js(before, after)
}
