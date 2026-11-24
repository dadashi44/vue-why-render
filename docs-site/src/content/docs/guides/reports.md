---
title: Reports
description: Save a session as JSON, open it again, print it, paste it into an issue, diff two of them.
---

Press **report** in the panel to save the whole session as JSON, or call the API:

```ts
const report = handle.getReport()   // a plain serialisable object
handle.saveReport()                 // the same thing, downloaded as a file
```

The file carries the package and Vue versions, the URL, the session length and
the scanner options alongside the numbers. Those are not decoration: without them
a report from someone else is unreadable, because there is no way to tell whether
a component never re-rendered or was simply filtered out.

## Opening a saved report

Press **open** in the panel, or drop a report file onto it. The panel switches to that
report — the same tabs, filter, hints and budget marks — with a bar on top saying whose
session it is and a **back to live** button. The live session keeps recording in the
background, so nothing is lost. **report** and **md** act on the open report.

The component tree is not stored in reports, so the **Tree** tab says so instead of
showing a flat list that would look like a tree with no children.

## Printing to the console

When the panel is off or in the way, print the session as a table:

```ts
import { printReport } from 'vue-why-render'

printReport()                       // the running session
printReport(parseReport(json))      // any saved report
handle.printReport({ limit: 10 })
```

`reportRows(report)` returns the same rows as plain objects, if you want them elsewhere.

## Pasting into an issue

Press **md** in the panel to copy the session as Markdown — top renders, the slowest
components, the most frequent reasons and the hints, as tables that render right in
the thread. Nothing to download or attach:

```ts
import { formatReportMarkdown } from 'vue-why-render'

const markdown = formatReportMarkdown(handle.getReport(), { limit: 10 })
```

The page URL is deliberately left out: an issue is public, and a URL can carry an
internal host or a token in the query. The JSON report still has it.

## Comparing two reports

Every other tool shows you a state. This one answers the question you actually
have after an optimisation — *did it help?*

```ts
import { diffReports, formatDiff, parseReport } from 'vue-why-render'

const diff = diffReports(parseReport(before), parseReport(after))
console.log(formatDiff(diff).join('\n'))
```

```
total ×19 → ×11  -42%

ProductCard  ×9 → ×1    -89%   reason gone: props:badge
```

Components are matched by `file::name`, not by `uid` — a uid lives for one session
and means nothing across two. Several instances of the same component are therefore
compared as one aggregate.

`diff.components` is ordered with regressions first: a render count that grew after
an "optimisation" is what you are looking for, not the one that shrank.

**The diff refuses to lie by omission.** When two reports are not comparable it says
so in `diff.warnings`, and `formatDiff` prints those lines first:

- the sessions differ in length — compare `beforePerSecond` / `afterPerSecond` instead of raw counts;
- `include` / `exclude` differ — the two runs watched different components;
- `includeMounts` or `minDuration` differ — the two runs counted different events;
- the reports came from different versions of the package.

A silent "−80%" that came from changing a filter is worse than no diff at all.
