---
title: 在编辑器中打开文件
description: 点击面板中的一行会打开哪个编辑器，以及如何指定。
---

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
