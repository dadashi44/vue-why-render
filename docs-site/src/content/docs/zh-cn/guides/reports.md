---
title: 报告
description: 把会话保存为 JSON、重新打开、打印、粘贴到 issue、比较两份报告。
---

点击面板上的 **报告** 按钮即可把整个会话保存为 JSON，也可以通过 API：

```ts
const report = handle.getReport()   // 一个普通的可序列化对象
handle.saveReport()                 // 同样的内容，直接下载为文件
```

文件中除数字外还记录了本包与 Vue 的版本、URL、会话时长和扫描器选项。这些并非装饰：
没有它们，别人的报告就无法解读 —— 分不清某个组件是真的没有重新渲染，还是被过滤掉了。

## 打开已保存的报告

点击面板上的 **打开**，或者直接把报告文件拖到面板上。面板会切换到这份报告：同样的标签页、过滤、
提示和预算标记，顶部有一栏说明这是谁的会话，并附带 **返回实时会话** 按钮。实时会话在后台继续记录，
不会丢失任何数据。**报告** 和 **md** 作用于当前打开的报告。

报告中不保存组件树，所以 **组件树** 标签页会直接说明这一点，而不是显示一个看起来像没有子节点的树的平铺列表。

## 打印到控制台

面板关闭或碍事时，可以把会话以表格形式打印出来：

```ts
import { printReport } from 'vue-why-render'

printReport()                       // 当前会话
printReport(parseReport(json))      // 任意已保存的报告
handle.printReport({ limit: 10 })
```

`reportRows(report)` 以普通对象返回同样的行，方便在别处使用。

## 粘贴到 issue

点击面板上的 **md** 按钮，即可把会话复制为 Markdown：渲染次数排行、最慢的组件、
最常见的原因以及提示，以表格形式直接显示在讨论串里，无需下载或附加文件：

```ts
import { formatReportMarkdown } from 'vue-why-render'

const markdown = formatReportMarkdown(handle.getReport(), { limit: 10 })
```

页面 URL 被刻意排除在外：issue 是公开的，而 URL 里可能带有内部主机名或 query 中的 token。
JSON 报告里仍然保留它。

## 比较两份报告

其他工具展示的是状态。本工具回答的是优化之后真正会问的那个问题：*有没有变好？*

```ts
import { diffReports, formatDiff, parseReport } from 'vue-why-render'

const diff = diffReports(parseReport(before), parseReport(after))
console.log(formatDiff(diff).join('\n'))
```

```
total ×19 → ×11  -42%

ProductCard  ×9 → ×1    -89%   reason gone: props:badge
```

组件按 `file::name` 匹配，而不是 `uid` —— uid 只在一次会话内有效，跨报告没有意义。
因此同一组件的多个实例会作为一个聚合来比较。

`diff.components` 把回归排在最前：在「优化」之后反而变多的渲染次数才是你要找的东西，
而不是变少的那个。

**这个 diff 不会靠沉默骗人。** 当两份报告不可比时，它会写进 `diff.warnings`，
并且 `formatDiff` 会把这些行放在最前面：

- 两次会话时长不同 —— 请比较 `beforePerSecond` / `afterPerSecond`，而不是原始计数；
- `include` / `exclude` 不同 —— 两次运行观察的组件集合不一样；
- `includeMounts` 或 `minDuration` 不同 —— 两次运行统计的事件不一样；
- 两份报告由不同版本的本包生成。

一个因为改了过滤器而得出、却被默默展示的「−80%」，比没有 diff 更糟。
