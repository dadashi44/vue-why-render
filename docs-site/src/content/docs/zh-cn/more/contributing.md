---
title: 开发与参与贡献
description: 如何在本地运行项目、CI 检查什么，以及如何提交 pull request。
---

## 开发

```sh
npm install
npm run dev        # 带演示组件的 playground
npm run dev:site   # 内嵌同一个 playground 的着陆页
npm run build:site # 将站点构建到 dist-site
npm test           # vitest
npm run test:coverage
npm run test:e2e   # playwright，在真实浏览器中测试面板
npm run typecheck  # vue-tsc
npm run lint
npm run build
```

测试会在 jsdom 中挂载真实的 Vue 应用，覆盖完整链路：从 ref 发生变化，到注册表以正确的
原因记录下来。高亮层针对打桩的 2d context 验证，面板则通过 `@vue/test-utils` 验证。

jsdom 本身做不到的部分——布局与拖拽、真实键盘、剪贴板、选择文件、`prefers-color-scheme`——由 `e2e/` 中的
Playwright 在一个小型测试应用上覆盖。逻辑不在那里重复，仍留在单元测试中。

CI 在 Node 20/22/24 上运行 lint、类型检查与测试，并单独验证 pnpm、yarn、bun 下的安装与
构建，随后用这四个包管理器分别把打包好的 tarball 装进一个干净工程，并同时调用 ESM 与
CJS 两个入口。

发布由 `v*` 标签触发，走 npm 的可信发布（trusted publishing）：仓库 secrets 中没有任何
token —— npm 用 Actions 的 OIDC token 换取一次性凭据，并自动附上 provenance。

## 参与贡献

欢迎提交 bug 报告、想法和 pull request —— 开发环境的搭建方式以及 pull request 需要包含的内容，
请参阅 [CONTRIBUTING.md](https://github.com/dadashi44/vue-why-render/blob/main/CONTRIBUTING.md)（英文）。
