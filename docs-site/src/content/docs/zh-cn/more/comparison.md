---
title: 与其他工具的比较
description: vue-why-render 与 Vue DevTools、Chrome Performance 面板有何不同。
---

| 功能 | vue-why-render | Vue DevTools | Chrome DevTools (Performance) |
|---------|:-:|:-:|:-:|
| **显示哪个组件重新渲染了** | 是 | 是（高亮） | 否 |
| **指出具体的 prop / ref / store 字段** | 是 | 否 | 否 |
| **「新引用，值相同」的判定** | 是 | 否 | 否 |
| **Pinia：store + 字段 + action** | 是 | 部分（仅 store） | 否 |
| **Vue Router：指出变化的参数** | 是 | 否 | 否 |
| **测试中的渲染断言** | 是 | 否 | 否 |
| **渲染预算（适合 CI）** | 是 | 否 | 否 |
| **保存 / 比对 / 比较报告** | 是 | 否 | 否 |
| **可操作的提示（该修什么）** | 是 | 否 | 否 |
| **火焰图 / CPU 分析** | 否 | 是 | 是 |
| **内存分析** | 否 | 否 | 是 |
| **可在生产环境使用** | 否 | 是 | 是 |

**Vue DevTools** 会显示某个组件更新了，但不会告诉你是哪个依赖引起的。要找到触发源，
你仍然得对 props 做二分排查，或者到处加 `watch`。`vue-why-render` 直接告诉你触发源 ——
它是一个调试工具，而不是通用的性能分析器。

**Chrome 的 Performance 面板** 分析 CPU 时间、绘制和布局。它无法告诉你 `ProductCard`
重新渲染是因为 `badge` 是一个值相同的新对象。两者配合使用：Chrome 用来看*时间花在了哪里*，
本包用来看*为什么会这样*。
