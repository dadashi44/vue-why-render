---
title: WASM 引擎
description: 热点路径上的算法由 Rust 编译为 WebAssembly 运行，并可透明回退到 JS。
---

自 0.7.0 起，热点路径上的算法 —— `buildTree`、`aggregateComponents`、`dedupeReasons`
和 `diffReports` —— 由 Rust 编译为 WebAssembly。WASM 二进制内联在打包产物中，并在第一次调用
`scan()` 时惰性加载；如果 WebAssembly 不可用（SSR、jsdom、严格的 CSP），本包会透明地回退到
原来的 JS 实现。

## 为什么不直接用 JS？

一个在 JS 堆上分配对象的性能分析工具，与你的应用由同一个垃圾回收器来衡量。`buildTree`
调用期间发生的一次大规模 GC 暂停，会让报告的渲染时间虚高 —— 工具扭曲了自己的测量结果。

对 V8 来说，WASM 线性内存只是一个 `ArrayBuffer`。垃圾回收器从不扫描其内部，也从不使其暂停，
而 Rust 通过所有权确定性地释放内存。结果是：工具的延迟更可预测，你拿到的数字也更准确。

## 基准测试

在 Apple M3 Pro 的 Chrome 131 中测得，`buildTree` 使用随机生成的组件树：

| 组件数 | JS 平均 | WASM 平均 | JS 最大 | WASM 最大 | JS 抖动 | WASM 抖动 |
|----------:|-------:|---------:|-------:|---------:|----------:|------------:|
| 100       | 0.03 ms | 0.02 ms | —      | —        | —         | —           |
| 500       | 0.05 ms | 0.04 ms | —      | —        | —         | —           |
| 1 000     | 0.10 ms | 0.10 ms | 2.3 ms | 0.3 ms   | —         | —           |
| 5 000     | 0.50 ms | 0.43 ms | 3.2 ms | 1.5 ms   | 2.9 ms    | 1.2 ms      |

GC 压力下（调用同时伴随大量短生命周期分配）：

| 组件数 | JS p99  | WASM p99 | JS 最大  | WASM 最大 |
|----------:|--------:|---------:|--------:|---------:|
| 5 000     | 1.0 ms  | 0.9 ms   | 1.3 ms  | 1.0 ms   |

原始吞吐量的提升有限（1.1–1.8 倍），因为在规模较大时，序列化边界（`serde-wasm-bindgen`）
占据主导。真正的收益是**尾部延迟的稳定性**：WASM 的最大值低 2 倍，抖动（最大值 − 最小值）
收窄 2.4 倍。对于测量工具而言，稳定的开销比平均速度更重要。

## API

```ts
import { loadWasm, isWasmReady, wasmVersion } from 'vue-why-render'

await loadWasm()        // 显式预加载（scan() 会自动完成）
isWasmReady()           // → true | false
wasmVersion()           // → "0.1.0" | null
```

如果 WASM 加载失败，只会输出一条 `console.warn`，之后每次调用都会静默地使用 JS 回退实现。
用户代码无需任何改动。

这三个函数也与包内其他函数一起列在 [API 参考](/docs/zh-cn/reference/api/)中。
