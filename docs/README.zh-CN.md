# vue-why-render

看清哪些 Vue 组件在重新渲染 —— 以及**究竟为什么**。

[![npm](https://img.shields.io/npm/v/vue-why-render?color=%236ee7a8)](https://www.npmjs.com/package/vue-why-render)
[![downloads](https://img.shields.io/npm/dm/vue-why-render?color=%236ee7a8)](https://npmtrends.com/vue-why-render)
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

- **给出原因，而不只是结果**：prop、ref、Pinia store 字段或数组下标，连同变更前后的值。
- **单独标注「新引用，值未变」** —— 这是多余渲染最常见的来源。
- **高亮层**：在重新渲染的组件周围绘制边框，颜色按频率从绿到红。
- **面板**：按渲染次数排行、按耗时排行、带子树合计的组件树，以及事件流。
- **跳转到编辑器**：点击一行即可通过开发服务器在 IDE 中打开对应的 SFC。
- **Pinia**：哪个 store、哪个字段，以及当时正在执行的 action —— `store cart.items (add) · action add()`。无需配置，也不依赖 Pinia。
- **Vue Router**：导航按变化的部分命名 —— `路由 params.id: "/p/1" → "/p/42"` —— 当组件在每次导航时都重新渲染，还会给出提示。
- **暂停、重置与过滤**：按组件名或文件路径；`Alt+Shift+P` 可用键盘暂停。面板可拖到任意位置，跟随系统的浅色或深色主题，一键复制原因。
- **Vue DevTools**：在扩展中提供检查器与时间线图层，且不引入新依赖。
- **Nuxt DevTools**：Nuxt 模块提供的 **Why render** 标签页，展示同一个实时面板，无额外依赖。
- **测试断言**：`expectRenders(ProductCard).toBe(0, …)` —— 修好一次的多余渲染不会再回来。
- **提示**：在原因旁边给出该怎么办 —— 提取对象、把处理函数提为方法、考虑 `v-memo`。
- **报告**：面板上一键把整个会话导出为 JSON，再用 `diffReports(before, after)` 证明修复确实奏效。已保存的报告可以重新在面板中打开，会话可以复制为 Markdown 贴进 issue，或通过 `printReport()` 打印到控制台。
- **渲染预算**：`budgets: { maxRenders: 5 }` 会在组件疯狂渲染时发出警告，`window.__VUE_WHY_RENDER__` 让 Playwright 测试可以借此使 CI 失败。
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
npm i -D https://github.com/dadashi44/vue-why-render/releases/download/v0.6.0/vue-why-render-0.6.0.tgz
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

#### Nuxt DevTools

模块会在 Nuxt DevTools 中添加一个 **Why render** 标签页 —— 同一个面板，实时更新，铺满整个标签页，
与其他工具并列。已在 DevTools 3.4 上验证；DevTools 4.0（仍在 beta）通过同一个 hook 收集模块标签页。不增加任何依赖：标签页是开发服务器提供的一个页面，
其中的面板由应用自己的 Vue 通过 `window.__VUE_WHY_RENDER__` 绘制。

如果浮动面板碍事，可以只保留标签页：

```ts
whyRender: { panel: false },        // DevTools 标签页依然可用
whyRender: { devtoolsTab: false },  // 或者反过来
```

`devtoolsTab` 只存在于 `nuxt.config` 中：标签页由构建注册，而不是由应用注册。

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
| `theme` | `'auto'` | 面板主题：`auto` 跟随 `prefers-color-scheme`，也可强制 `dark` / `light`。 |
| `pauseHotkey` | `'Alt+Shift+P'` | 暂停 / 继续记录的快捷键，关闭面板时同样有效。`false` 表示不绑定。 |
| `sampleRate` | `1` | 记录的渲染比例，`0`–`1`。组件数以千计时，`0.1` 只记录十分之一，其余的工作全部跳过。此时计数是采样值 —— 面板标题和报告都会注明。 |
| `budgets` | `[]` | 渲染预算，见 [预算](#预算)。 |
| `pinia` | `true` | 识别 Pinia store 以及修改它们的 action。无需把 Pinia 作为依赖。 |
| `router` | `true` | 识别 Vue Router 导航，并指出路由中具体变化了什么。无需把路由器作为依赖。 |
| `onBudgetExceeded` | — | 每个组件第一次超出预算时调用。 |
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

## 预算

规定组件多久可以重新渲染一次，或一次更新最多耗时多少，一旦不满足，扫描器会立即告诉你：

```ts
app.use(VueWhyRender, {
    budgets: [
        { maxRenders: 5, per: 1000 },                     // 任意组件，每秒 5 次渲染
        { include: [/^ProductCard$/], maxDuration: 16 },  // 每次更新不超过一帧
    ],
})
```

```
[vue-why-render] budget exceeded: ProductCard rendered 12 times in 1000ms (limit 5) — last reason: prop badge: { text } → { text } — new reference, same value
```

时间窗口按实例计算：要问的是“这个组件是否在疯狂渲染？”，而不是“列表里有多少行”。
每个组件、每种违规只在控制台提示一次，之后只累加次数和最差值。面板会把违规组件的渲染次数标红，
违规信息也会写入报告、Markdown 块和 `printReport()`。

### 让 CI 失败

Playwright 测试无法导入页面中的模块，所以扫描器会在 `window.__VUE_WHY_RENDER__` 上放一个小句柄：
`getReport()`、`getViolations()`、`printReport()`、`pause()`、`resume()`、`reset()`。
请在开发模式下运行应用，扫描器此时是开启的：

```ts
test('目录页不超出渲染预算', async ({ page }) => {
    await page.goto('/catalog')
    await page.getByRole('searchbox').fill('鼠标')

    const violations = await page.evaluate(() => window.__VUE_WHY_RENDER__?.getViolations() ?? [])
    expect(violations).toEqual([])
})
```

`stop()` 会移除这个句柄。组件测试请改用测试中的渲染断言。

## 提示

面板会在原因旁边给出应对建议：

```
ProductCard ×7
проп badge: { text } → { text } — 新引用，值未变
💡 badge: 这个对象似乎在父组件中被重新创建 —— 可以提取为常量或 computed
```

目前识别四种模式，全部只依赖运行时数据，不读取源码：

| 数据中看到的 | 提示 |
| --- | --- |
| prop 仅引用变了，值相等 | 对象在父组件中被重建 —— 提取出去 |
| prop 是函数，且每次渲染都是新的 | 处理函数被重新创建 —— 提取为方法 |
| 发生了渲染，但既无原因也无 prop 变化 | 由父组件驱动 —— 可以考虑 `v-memo` |
| 原因是路由变化 | 读取路由会订阅每一次导航 —— 把需要的字段包进 `computed` |

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

### 打开已保存的报告

点击面板上的 **打开**，或者直接把报告文件拖到面板上。面板会切换到这份报告：同样的标签页、过滤、
提示和预算标记，顶部有一栏说明这是谁的会话，并附带 **返回实时会话** 按钮。实时会话在后台继续记录，
不会丢失任何数据。**报告** 和 **md** 作用于当前打开的报告。

报告中不保存组件树，所以 **组件树** 标签页会直接说明这一点，而不是显示一个看起来像没有子节点的树的平铺列表。

### 打印到控制台

面板关闭或碍事时，可以把会话以表格形式打印出来：

```ts
import { printReport } from 'vue-why-render'

printReport()                       // 当前会话
printReport(parseReport(json))      // 任意已保存的报告
handle.printReport({ limit: 10 })
```

`reportRows(report)` 以普通对象返回同样的行，方便在别处使用。

### 粘贴到 issue

点击面板上的 **md** 按钮，即可把会话复制为 Markdown：渲染次数排行、最慢的组件、
最常见的原因以及提示，以表格形式直接显示在讨论串里，无需下载或附加文件：

```ts
import { formatReportMarkdown } from 'vue-why-render'

const markdown = formatReportMarkdown(handle.getReport(), { limit: 10 })
```

页面 URL 被刻意排除在外：issue 是公开的，而 URL 里可能带有内部主机名或 query 中的 token。
JSON 报告里仍然保留它。

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

## Pinia

当原因来自 store 时，面板会指出是哪个 store、哪个字段，以及当时正在执行的 action：

```
CartSummary ×3 · 0.2ms
├─ store cart.items: Array(1) → Array(0) · action clear()
└─ store cart.total: 2100 → 0 · action clear()
```

无需任何配置：无论 `app.use(pinia)` 和本插件的调用顺序如何，本包都会自行在应用上找到 Pinia，
并且同时支持 Pinia 2、3、4，而不依赖其中任何一个。

为什么这需要额外的工作：Vue 报告的是发生变化的那个对象，而对 store 来说它从来不是 store 本身。
`cart.count++` 触发在状态对象上，`cart.items.push()` 触发在数组上，setup store 的 `ref` 触发在 ref 自身上，
它们都不知道自己属于哪个 store。因此本包维护了一个索引：记录每个 store 状态中每个对象所在的位置。
查找只是一次 `WeakMap` 读取；当有新对象放入 store（`push({ … })`、`cart.current = { … }`）时，
它的子树会立即加入索引。

- **action** 来自 `$onAction`。异步 action 在结束之前都算作正在执行，所以 `await` 之后的修改仍归属于它；
  嵌套调用时以最内层的 action 为准。组件中的直接赋值或 `$patch` 没有 action，面板也不会凭空编造。
- **向 store 中的数组添加或删除元素**时，原因记为数组本身——`store cart.items (add)`，而不是 `cart.items[7]`：
  每次 `push` 的下标都不同，差异对比、频率表和预算每次都会看到一个“新原因”。
- **限制。** 索引最多深入四层，每个 store 最多 500 个节点。store 中超大数组的尾部会显示为普通的数组变化，不带 store 名称。

`pinia: false` 可以全部关闭。

## Vue Router

导航会按路由中实际变化的部分来命名，而不是报告成“某个 ref 把一个路由对象换成了另一个”：

```
ProductPage ×3 · 1.2ms
└─ 路由 params.id: "/p/1" → "/p/42"
```

params、query 和 hash 按键名指出 —— `params.id`、`query.tab`、`hash`：参数才是原因，路径只是结果。
只有这些都没变、也就是页面本身变了的时候，才会显示 `path`。值是变化前后的完整路径，既能看出变了什么，
也能看出从哪里来。键名不包含值，所以对报告差异和预算来说，每次 `params.id` 的跳转都是同一个原因。

**提示。** `useRoute()` 和 `$route` 读取的是同一个 ref，因此只要组件读取了路由的任意字段，就会在**每一次**导航时重新渲染 ——
只显示路径的页头，在 query 变化时也会重新渲染。面板会指出这一点并给出办法：如果只需要一个字段，
`computed(() => route.params.id)` 只会在该字段变化时触发重新渲染。组件读取了哪些字段在运行时无法得知，所以这只是建议，而非结论。

同时支持 Vue Router 4 和 5，且不依赖其中任何一个。`router: false` 可以关闭。

## 原因是如何判定的

一个全局 mixin 为每个组件挂上 `renderTriggered`。Vue 会向它传入
`{ target, type, key, oldValue, newValue }` —— 即目标对象、键名，以及变更前后的值。
本包据此把它翻译成人话：

- `target === instance.props` → 这是一个 **prop**；
- 目标位于某个 Pinia store 的状态中 → **store** 及其内部路径（`cart.items`、`cart.meta.open`），见 [Pinia](#pinia)；
- 目标是 ref 且键名为 `value` → 到 `setupState` 里反查变量名，显示 **state count**，
  而不是毫无意义的 `value`；
- 数组 → `[3]`；`Map` 或 `Set` → 集合；
- 目标是路由器的当前路由 → **路由**变化，按变化的部分命名（`params.id`、`query.tab`），见 [Vue Router](#vue-router)；
- 完全没有目标 → **计算属性**。Vue 3.5 在通知组件计算属性变化时不附带任何调试信息，因此本包会遍历组件自身的依赖，找出刚刚失效的计算属性，并按 `setupState` 中的名字称呼它 —— **计算属性 total**。在组件外、composable 或 store 中声明的计算属性无名可取，只显示为 **计算属性**。

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

## 许可证

MIT
