---
title: 案例
description: 为了一个数字，每分钟重新渲染 600 次 —— vue-why-render 在电竞平台 BIGPLAY 上的实践。
---

**为了一个数字，每分钟重新渲染 600 次。** 电竞平台 BIGPLAY 的前端被整个过了一遍
vue-why-render：七处修改，每处只有几行代码或一个拆出来的组件，在存在浪费的地方消除了
70% 到 98% 的多余工作。其中主要的几处已用生产数据验证。

技术栈：Nuxt 3.14、Vue 3.5.38、Pinia、vue-why-render 0.8.0。文章讲到：如何用一个开关接入
扫描器、保证不会进入生产；如何用 `diffReports` 比较「修改前」与「修改后」的报告；
为什么由 ref 引起的重新渲染，可能要到并不闪烁的那个组件里去找；以及「零次重新渲染」的测试
如何在什么都没检查的情况下通过。

案例是俄语的：[在项目站点阅读](https://vue-why-render.js.org/cases/bigplay/)。

报告与 `diffReports` 见[报告](/docs/zh-cn/guides/reports/)，测试断言见[在测试中断言渲染次数](/docs/zh-cn/guides/tests/)。
