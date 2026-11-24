---
title: Открытие файлов в редакторе
description: Какой редактор откроется по клику на строку в панели и как его выбрать.
---

Клик по строке в панели просит дев-сервер открыть файл. Редактор выбирает не
пакет — это делает [`launch-editor`](https://github.com/yyx990803/launch-editor)
на стороне Vite или Nuxt, и по умолчанию он угадывает.

Угадывает он VS Code. Если команды `code` нет в `PATH`, в терминале появится вот
это, а файл не откроется:

```
The editor process exited with an error: spawn code ENOENT
('code' command does not exist in 'PATH').
```

Назовите редактор явно — в `.env` проекта или в профиле оболочки, чтобы работало
во всех проектах сразу:

```sh
LAUNCH_EDITOR=webstorm
```

Понимает `code`, `cursor`, `webstorm`, `idea`, `phpstorm`, `goland`, `rubymine`,
`pycharm`, `sublime`, `atom`, `vim`, `emacs` и другие. Сама запускалка должна
существовать: у JetBrains её ставит Toolbox, у VS Code — команда
*Shell Command: Install 'code' command in PATH*.

После этого перезапустите дев-сервер.

Сам эндпоинт пакет ищет сам: сначала пробует настроенный `openInEditorUrl`, потом
вайтовский `/__open-in-editor`, потом нукстовский `/__nuxt_devtools__/open-in-editor`.
Если не ответил никто — один раз за сессию пишет подсказку в консоль браузера.
