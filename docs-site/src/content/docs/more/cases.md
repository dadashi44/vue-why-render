---
title: Case study
description: 600 re-renders a minute for one number — vue-why-render on the BIGPLAY esports platform.
---

**600 re-renders a minute for one number.** The front end of the BIGPLAY esports
platform was run through vue-why-render: seven fixes, each a few lines or one extracted
component, removed 70 to 98% of the wasted work where it existed. The main ones were
verified on production data.

The stack: Nuxt 3.14, Vue 3.5.38, Pinia, vue-why-render 0.8.0. The write-up covers how the
scanner was wired in behind a single flag so nothing reaches production, how the "before"
and "after" reports were compared with `diffReports`, and why a re-render caused by a ref can
be hiding in a different component than the one that flashes. It also shows how a
"zero re-renders" test can pass while checking nothing.

The case is in Russian: [read it on the project site](https://vue-why-render.js.org/cases/bigplay/).

Reports and `diffReports` are described in [Reports](/docs/guides/reports/); the test
assertion in [Render assertions in tests](/docs/guides/tests/).
