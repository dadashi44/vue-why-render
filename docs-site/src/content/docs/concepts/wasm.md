---
title: WASM engine
description: The hot-path algorithms run in Rust compiled to WebAssembly, with a transparent JS fallback.
---

Since 0.7.0 the hot-path algorithms — `buildTree`, `aggregateComponents`, `dedupeReasons`
and `diffReports` — are compiled from Rust to WebAssembly. The WASM binary is inlined in
the bundle and loaded lazily on the first `scan()` call; if WebAssembly is unavailable
(SSR, jsdom, restrictive CSP) the package falls back to the original JS implementations
transparently.

## Why not just JS?

A profiling tool that allocates objects on the JS heap is measured by the same GC that
measures your application. A major GC pause during a `buildTree` call inflates the
reported render time — the tool distorts its own measurements.

WASM linear memory is a single `ArrayBuffer` to V8. The garbage collector never scans
inside it, never pauses it, and Rust frees memory deterministically through ownership.
The result: more predictable latency for the tool, more accurate numbers for you.

## Benchmarks

Measured in Chrome 131 on Apple M3 Pro, `buildTree` with randomised component trees:

| Components | JS avg | WASM avg | JS max | WASM max | JS jitter | WASM jitter |
|----------:|-------:|---------:|-------:|---------:|----------:|------------:|
| 100       | 0.03 ms | 0.02 ms | —      | —        | —         | —           |
| 500       | 0.05 ms | 0.04 ms | —      | —        | —         | —           |
| 1 000     | 0.10 ms | 0.10 ms | 2.3 ms | 0.3 ms   | —         | —           |
| 5 000     | 0.50 ms | 0.43 ms | 3.2 ms | 1.5 ms   | 2.9 ms    | 1.2 ms      |

Under GC pressure (heavy short-lived allocations alongside the call):

| Components | JS p99  | WASM p99 | JS max  | WASM max |
|----------:|--------:|---------:|--------:|---------:|
| 5 000     | 1.0 ms  | 0.9 ms   | 1.3 ms  | 1.0 ms   |

Raw throughput gains are modest (1.1–1.8×) because the serialization boundary
(`serde-wasm-bindgen`) dominates at larger sizes. The real win is **tail-latency
stability**: WASM max is 2× lower and jitter (max − min) is 2.4× tighter. For a
measurement tool, consistent overhead matters more than average speed.

## API

```ts
import { loadWasm, isWasmReady, wasmVersion } from 'vue-why-render'

await loadWasm()        // explicit preload (scan() does this automatically)
isWasmReady()           // → true | false
wasmVersion()           // → "0.1.0" | null
```

If WASM fails to load, a single `console.warn` is emitted and every call silently
uses the JS fallback. No user code needs to change.

The same three functions are listed with the rest of the package in the [API reference](/docs/reference/api/).
