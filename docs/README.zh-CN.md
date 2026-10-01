# vue-why-render

看清哪些 Vue 组件在重新渲染 —— 以及**究竟为什么**。

[![npm](https://img.shields.io/npm/v/vue-why-render?color=%236ee7a8)](https://www.npmjs.com/package/vue-why-render)
[![license](https://img.shields.io/npm/l/vue-why-render)](https://github.com/dadashi44/vue-why-render/blob/main/LICENSE)

**[在线演示 →](https://dadashi44.github.io/vue-why-render/)** · [English](https://github.com/dadashi44/vue-why-render/blob/main/README.md) · [Русский](https://github.com/dadashi44/vue-why-render/blob/main/docs/README.ru.md)

![vue-why-render：组件重新渲染，面板指出背后的 prop](https://raw.githubusercontent.com/dadashi44/vue-why-render/main/docs/demo.gif)

同类工具会在刚更新的组件周围闪一圈边框。这足以让你发现问题，却不足以让你修好它 ——
你依然要问：*到底是什么变了？* `vue-why-render` 回答的正是这个问题：它会指出触发这次
渲染的那个具体的响应式依赖。

```
ProductCard ×7 · 2.4ms · badge
└─ prop badge: { text } → { text } — 新引用，值未变
```

在 React 里这只能靠逐个比对 props 去猜。而 Vue 通过 `renderTriggered` 钩子直接把原因
交给你 —— 本包正是围绕它构建的。

## 功能

- **给出原因，而不只是结果**：prop、ref、store 的键名或数组下标，连同变更前后的值。
- **单独标注「新引用，值未变」** —— 这是多余渲染最常见的来源。
- **高亮层**：在重新渲染的组件周围绘制边框，颜色按频率从绿到红。
- **面板**：按渲染次数排行、按耗时排行、带子树合计的组件树，以及事件流。
- **跳转到编辑器**：点击一行即可通过开发服务器在 IDE 中打开对应的 SFC。
- **暂停、重置与过滤**：按组件名或文件路径。
- **Vue DevTools**：在扩展中提供检查器与时间线图层，且不引入新依赖。
- **测试断言**：`expectRenders(ProductCard).toBe(0, …)` —— 修好一次的多余渲染不会再回来。
- **提示**：在原因旁边给出该怎么办 —— 提取对象、把处理函数提为方法、考虑 `v-memo`。
- **报告**：面板上一键把整个会话导出为 JSON，再用 `diffReports(before, after)` 证明修复确实奏效。
- **API**：`getStats()`、`getEvents()`、`getReport()` 以及 `onRender` 回调，可用于自建工具。

## 安装

```sh
npm install -D vue-why-render
pnpm add -D vue-why-render
yarn add -D vue-why-render
bun add -d vue-why-render
```

需要 Vue 3.3+。本包没有任何运行时依赖。

### 不经由 npm，直接从 GitHub 安装

如果无法从 registry 安装，每个[发布版本](https://github.com/dadashi44/vue-why-render/releases)
都附带 tarball，可通过直链安装，无需任何鉴权：

```sh
npm i -D https://github.com/dadashi44/vue-why-render/releases/download/v0.4.0/vue-why-render-0.4.0.tgz
```

## 使用

### Vue

```ts
import { createApp } from 'vue'
import VueWhyRender from 'vue-why-render'
import App from './App.vue'

const app = createApp(App)

app.use(VueWhyRender, {
    exclude: [/^RouterLink/, /^Transition/],
})

app.mount('#app')
```

### Nuxt

直接引入模块。它会在开发模式下注册一个仅客户端插件，而在生产构建中不留下任何痕迹 ——
连 import 都没有：

```ts
// nuxt.config.ts
export default defineNuxtConfig({
    modules: ['vue-why-render/nuxt'],
    whyRender: {
        exclude: [/^RouterLink/, /^Transition/],
        includeMounts: true,
    },
})
```

下表中的所有选项都可以写在 `whyRender` 键下，只有 `onRender` 除外：回调函数无法从
`nuxt.config` 搬进生成的插件。如果需要回调，请按下面的方式手动注册。出于同样的原因，
`include` 和 `exclude` 中的函数会被丢弃并在终端给出提示；正则和字符串则完整保留。

#### 手动注册，不使用模块

```ts
// plugins/why-render.client.ts —— .client 后缀使其不进入 SSR
import VueWhyRender from 'vue-why-render'

export default defineNuxtPlugin((nuxtApp) => {
    nuxtApp.vueApp.use(VueWhyRender)
})
```

请注意：除非自己手动剔除，这种写法会进入生产构建 —— 见[开销](#开销)。
模块的存在正是为了让人无法忘记这件事。

### 手动调用，不使用插件

```ts
import { scan } from 'vue-why-render'

const handle = scan(app, { panel: false })

handle?.pause()
handle?.getStats()
handle?.stop()
```

## 配置项

| 配置项 | 默认值 | 作用 |
| --- | --- | --- |
| `enabled` | `true` | 启用扫描器。本包不会去猜测构建模式 —— 参见[开销](#开销)。 |
| `overlay` | `true` | 在重新渲染的组件周围绘制边框。 |
| `panel` | `true` | 浮动统计面板。 |
| `devtools` | `true` | 在 Vue DevTools 中注册检查器与时间线图层。 |
| `showLabels` | `true` | 在边框上显示组件名标签。 |
| `includeMounts` | `false` | 除更新外，也记录首次挂载。 |
| `trackReasons` | `true` | 通过 `renderTriggered` 收集原因。 |
| `trackProps` | `true` | 在相邻更新之间比对 props。 |
| `include` | `[]` | 只监视这些组件：字符串、正则或函数。 |
| `exclude` | `[]` | 忽略这些组件。优先级高于 `include`。 |
| `minDuration` | `0` | 忽略快于该毫秒数的更新。 |
| `hotThreshold` | `5` | 每秒多少次渲染算作「过热」。 |
| `maxEvents` | `500` | 事件环形缓冲区的大小。 |
| `flushInterval` | `250` | 面板拉取新快照的间隔，毫秒。 |
| `displayDuration` | `600` | 边框保持可见的时长，毫秒。 |
| `openInEditorUrl` | `/__open-in-editor?file={file}` | 在编辑器中打开文件的链接模板。 |
| `locale` | `'en'` | 面板语言：`en`、`ru` 或 `zh-CN`。 |
| `onRender` | — | 每次渲染事件触发的回调。 |

## Vue DevTools

如果安装了扩展，本包也会在其中注册：组件树旁边会出现 **Why render** 检查器，
时间线上会出现 **Why render** 图层，每次渲染对应一个事件。

检查器按渲染次数列出组件；选中某个组件即可看到它最后一次渲染的原因、prop 的差异和提示。
无需任何配置 —— DevTools 打开时它就在，不打开时它什么也不花费。

```ts
app.use(VueWhyRender, { devtools: false })   // 只想要自带面板时
```

**如果检查器没有出现**，原因通常不在本包。Vue DevTools 有一个 **High Performance Mode**，
只要它处于开启状态，任何第三方检查器都不会被创建 —— 本包的不会，Pinia 的不会，路由的也不会。
这道关卡位于 `@vue/devtools-kit` 中：

```js
if (devtoolsState.highPerfModeEnabled && !options?.inspectingComponent) return
```

在 Vue 标签页的设置里关掉它，然后刷新页面。第二个条件是 Vue 标签页必须处于打开状态：
插件是在 DevTools 客户端连接时才被实例化的，在那之前注册只是待在队列里。

这并不会取代自带面板，面板也不会被移除。扩展并非到处都能装：内网环境、演示时别人的浏览器、
WebView。面板在没有 DevTools 的地方工作，而 DevTools 在它存在的地方更顺手。

**没有引入新依赖。** 常规做法是使用 `@vue/devtools-api`，但它在第 8 版会带上
`@vue/devtools-kit`。整个接入点其实只是 `window.__VUE_DEVTOOLS_GLOBAL_HOOK__` 上的一个事件，
因此这段桥接是自己写的 —— 大约二十行，本包依旧保持零运行时依赖。

## 在测试中断言渲染次数

扫描器会统计渲染次数，因此可以把它用来防止回归：修好一次的多余渲染，就不会再回来。

```ts
import { mount } from '@vue/test-utils'
import { expectRenders, renderTracking, stopRenderTracking } from 'vue-why-render/test'

afterEach(() => stopRenderTracking())

it('筛选时卡片不应重新渲染', async () => {
    const wrapper = mount(App, { global: { plugins: [renderTracking()] } })

    await expectRenders(ProductCard).toBe(0, async () => {
        await wrapper.find('input').setValue('mouse')
    })
})
```

断言失败时，它给出的不只是一个数字，而是原因：

```
[vue-why-render] expected ProductCard to re-render 0 time(s), but it re-rendered 1 time(s)
reasons:
  - prop badge: { text } -> { text } (new reference, same value)
```

| 辅助函数 | 作用 |
| --- | --- |
| `renderTracking(options?)` | 用于 `global.plugins` 的 Vue 插件。`mount()` 自行创建应用且不对外暴露，插件是唯一入口。 |
| `expectRenders(target).toBe(n, action)` | 动作期间恰好 `n` 次重新渲染。 |
| `expectRenders(target).toBeAtMost(n, action)` | 不超过 `n` 次，适用于精确数字过于脆弱的场景。 |
| `recordRenders(action)` | 返回该窗口内原始的 `RenderEvent[]`，可自行编写断言。 |
| `stopRenderTracking()` | 在 `afterEach` 中调用，否则追踪器会比测试活得更久。 |

`target` 可以是组件本身、组件名，或一个正则。

有两件事已经替你决定好，不会带来意外：面板与高亮层默认关闭，不会干扰测试查询的 DOM；
挂载不计入次数，因为首次渲染从来不是多余的那一次。

动作结束后辅助函数会等待 `nextTick` —— Vue 的更新是异步的，否则任何断言都会看到零次渲染，
并因为错误的原因而通过。

## 提示

面板会在原因旁边给出应对建议：

```
ProductCard ×7
проп badge: { text } → { text } — 新引用，值未变
💡 badge: 这个对象似乎在父组件中被重新创建 —— 可以提取为常量或 computed
```

目前识别三种模式，全部只依赖运行时数据，不读取源码：

| 数据中看到的 | 提示 |
| --- | --- |
| prop 仅引用变了，值相等 | 对象在父组件中被重建 —— 提取出去 |
| prop 是函数，且每次渲染都是新的 | 处理函数被重新创建 —— 提取为方法 |
| 发生了渲染，但既无原因也无 prop 变化 | 由父组件驱动 —— 可以考虑 `v-memo` |

**提示是推测，不是诊断。** 本包知道某个 prop 以新引用到达，却不知道它来自哪里 ——
模板里的内联调用、没有记忆化的 `computed`，还是 store。因此措辞是克制的；
凡是无法诚实推导的情况，提示都会保持沉默：

- 当 `trackProps: false` 或 `trackReasons: false` 时，「什么都没变」其实意味着「我们没在看」，因此不会给出 `v-memo` 提示；
- 只挂载过、从未更新的组件不会得到任何提示：对从未更新过的东西建议记忆化，比什么都不说更糟。

在保存的报告里，提示位于每个组件的 `hints` 字段中。

## 报告

点击面板上的 **报告** 按钮即可把整个会话保存为 JSON，也可以通过 API：

```ts
const report = handle.getReport()   // 一个普通的可序列化对象
handle.saveReport()                 // 同样的内容，直接下载为文件
```

文件中除数字外还记录了本包与 Vue 的版本、URL、会话时长和扫描器选项。这些并非装饰：
没有它们，别人的报告就无法解读 —— 分不清某个组件是真的没有重新渲染，还是被过滤掉了。

### 比较两份报告

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

## 原因是如何判定的

一个全局 mixin 为每个组件挂上 `renderTriggered`。Vue 会向它传入
`{ target, type, key, oldValue, newValue }` —— 即目标对象、键名，以及变更前后的值。
本包据此把它翻译成人话：

- `target === instance.props` → 这是一个 **prop**；
- 目标带有 `$id` → 这是一个 **store**（`cart.items`）；
- 目标是 ref 且键名为 `value` → 到 `setupState` 里反查变量名，显示 **state count**，
  而不是毫无意义的 `value`；
- 数组 → `[3]`；`Map` 或 `Set` → 集合。

除此之外，还会独立地在相邻两次更新之间比对 props。正是这一步能抓住「父组件每次都传下来
一个新建字面量」的情况。

## 开销

这是一个仅用于开发环境的工具，原因有三，且都不是出于过度谨慎：

1. `renderTriggered` 只在 Vue 的开发构建中触发 —— 生产环境下该钩子根本不会被调用。
2. 回调会在每一次响应式触发时执行。如果你专门要profiling耗时，请设置 `trackReasons: false`。
3. 全局 mixin 会给应用中的每个组件都加上钩子。

`renderTracked` —— 它在响应式值每次被**读取**时触发 —— 是刻意不使用的：那是每秒数千次
调用，profiling 本身就失去了意义。

**在生产环境关掉扫描器是调用方的责任。** 本包不会试图猜测构建模式：浏览器产物中没有
`process`，而对 `process.env.NODE_ENV` 的裸引用会破坏使用方的生产构建 ——
`@rollup/plugin-commonjs` 会把这样的 ESM 文件误认为混合 CommonJS，并将其改写成语法损坏的
代码。因此扫描器默认就是开启的。

正确的做法是使用打包器的静态标志，它会同时消除调用与 import 本身：

```ts
// Vite
if (import.meta.env.DEV) {
    const { default: VueWhyRender } = await import('vue-why-render')
    app.use(VueWhyRender)
}
```

**在 Nuxt 中请使用模块** —— `modules: ['vue-why-render/nuxt']`。它替你完成了这件事：
生产构建中根本不会注册插件，也就没有什么需要剔除的。模块存在的意义正在于此。

## 在编辑器中打开文件

点击面板中的一行，会请求开发服务器打开对应文件。选择哪个编辑器不由本包决定 ——
这是 Vite 或 Nuxt 一侧的 [`launch-editor`](https://github.com/yyx990803/launch-editor)
在做，而且默认是靠猜。

它猜的是 VS Code。如果 `code` 命令不在 `PATH` 里，终端会出现下面这行，文件也打不开：

```
The editor process exited with an error: spawn code ENOENT
('code' command does not exist in 'PATH').
```

显式指定你的编辑器 —— 写进项目的 `.env`，或者写进 shell 配置以便所有项目通用：

```sh
LAUNCH_EDITOR=webstorm
```

可识别的值包括 `code`、`cursor`、`webstorm`、`idea`、`phpstorm`、`goland`、
`rubymine`、`pycharm`、`sublime`、`atom`、`vim`、`emacs` 等。对应的命令行启动器
必须存在：JetBrains 系由 Toolbox 安装，VS Code 用
*Shell Command: Install 'code' command in PATH*。

改完后重启开发服务器。

端点本身由本包自动寻找：先试配置里的 `openInEditorUrl`，再试 Vite 的
`/__open-in-editor`，最后试 Nuxt 的 `/__nuxt_devtools__/open-in-editor`。
如果都没有响应，会在浏览器控制台打印一次提示。

## 本包不做什么

- 它不能替代 Vue DevTools 的火焰图或浏览器 trace：它告诉你*什么*重新渲染了、*为什么*，而不是渲染内部的时间去了哪里。
- 它不在生产环境工作。
- 它不支持 Vue 2。

## 开发

```sh
npm install
npm run dev        # 带演示组件的 playground
npm run dev:site   # 内嵌同一个 playground 的着陆页
npm run build:site # 将站点构建到 dist-site
npm test           # vitest
npm run test:coverage
npm run typecheck  # vue-tsc
npm run lint
npm run build
```

测试会在 jsdom 中挂载真实的 Vue 应用，覆盖完整链路：从 ref 发生变化，到注册表以正确的
原因记录下来。高亮层针对打桩的 2d context 验证，面板则通过 `@vue/test-utils` 验证。

CI 在 Node 20/22/24 上运行 lint、类型检查与测试，并单独验证 pnpm、yarn、bun 下的安装与
构建，随后用这四个包管理器分别把打包好的 tarball 装进一个干净工程，并同时调用 ESM 与
CJS 两个入口。

发布由 `v*` 标签触发，走 npm 的可信发布（trusted publishing）：仓库 secrets 中没有任何
token —— npm 用 Actions 的 OIDC token 换取一次性凭据，并自动附上 provenance。

## 许可证

MIT
