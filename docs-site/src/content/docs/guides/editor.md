---
title: Opening files in your editor
description: Which editor opens when you click a row in the panel, and how to choose it.
---

Clicking a row in the panel asks the dev server to open the file. The package does
not pick the editor — that is done by [`launch-editor`](https://github.com/yyx990803/launch-editor)
on the Vite or Nuxt side, and by default it guesses.

The guess is VS Code. If the `code` command is not in your PATH you get this in the
terminal and nothing opens:

```
The editor process exited with an error: spawn code ENOENT
('code' command does not exist in 'PATH').
```

Name your editor explicitly — in the project `.env`, or in your shell profile to
cover every project at once:

```sh
LAUNCH_EDITOR=webstorm
```

Recognised values include `code`, `cursor`, `webstorm`, `idea`, `phpstorm`,
`goland`, `rubymine`, `pycharm`, `sublime`, `atom`, `vim` and `emacs`. The matching
CLI launcher has to exist — JetBrains IDEs install theirs through Toolbox, VS Code
through *Shell Command: Install 'code' command in PATH*.

Restart the dev server afterwards.

The endpoint itself is found automatically: the package tries the configured
`openInEditorUrl`, then Vite's `/__open-in-editor`, then Nuxt's
`/__nuxt_devtools__/open-in-editor`. If none of them answers, it prints a hint to
the browser console once per session.
