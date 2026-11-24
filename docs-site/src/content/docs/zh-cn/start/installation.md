---
title: 安装
description: 通过 npm、pnpm、yarn 或 bun 安装 vue-why-render，也可直接从 GitHub 发布版本安装。
---

```sh
npm install -D vue-why-render
pnpm add -D vue-why-render
yarn add -D vue-why-render
bun add -d vue-why-render
```

需要 Vue 3.3+。本包没有任何运行时依赖。

## 不经由 npm，直接从 GitHub 安装

如果无法从 registry 安装，每个[发布版本](https://github.com/dadashi44/vue-why-render/releases)
都附带 tarball，可通过直链安装，无需任何鉴权：

```sh
npm i -D https://github.com/dadashi44/vue-why-render/releases/download/v0.6.0/vue-why-render-0.6.0.tgz
```

接下来：在 [Vue 应用](/docs/zh-cn/start/vue/)或 [Nuxt 项目](/docs/zh-cn/start/nuxt/)中接入。
